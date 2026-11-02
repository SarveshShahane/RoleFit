import asyncio
import io
import json
import os
import urllib.parse
import uuid
import boto3
from botocore.exceptions import ClientError
import httpx
import pypdf

_s3_client = None


def get_s3():
    global _s3_client
    if _s3_client is None:
        region = (
            os.getenv("AWS_REGION")
            or os.getenv("REGION_NAME")
            or os.getenv("AWS_DEFAULT_REGION")
            or ""
        ).strip().strip('"').strip("'")
        _s3_client = boto3.client("s3", region_name=region if region else None)
    return _s3_client


def extract_event_info(event: dict):
    """
    Handles:
    1. S3 -> SQS -> Lambda (double-wrapped JSON string in record['body'])
    2. Direct S3 -> Lambda (record['s3'])
    3. Custom SQS payload (JSON string in record['body'])
    4. Direct test invocation (event['bucket'], event['key'])
    """
    default_bucket = (
        os.getenv("S3_BUCKET_NAME")
        or os.getenv("BUCKET_NAME")
        or os.getenv("DB_BUCKET_NAME")
        or ""
    ).strip().strip('"').strip("'")

    bucket = default_bucket
    key = ""
    candidate_name, role = None, None

    if "Records" in event and event["Records"]:
        rec = event["Records"][0]
        if "s3" in rec:
            bucket = rec["s3"]["bucket"]["name"]
            key = rec["s3"]["object"]["key"]
        elif "body" in rec:
            body = rec["body"]
            if isinstance(body, str):
                body = json.loads(body)
            if isinstance(body, str):
                body = json.loads(body)

            if isinstance(body, dict) and "Records" in body and body["Records"] and "s3" in body["Records"][0]:
                s3_info = body["Records"][0]["s3"]
                bucket = s3_info["bucket"]["name"]
                key = s3_info["object"]["key"]
            elif isinstance(body, dict):
                bucket = body.get("bucket", default_bucket)
                key = body.get("key", "")
                candidate_name = body.get("candidate_name")
                role = body.get("role")
    else:
        bucket = event.get("bucket", default_bucket)
        key = event.get("key", "")
        candidate_name = event.get("candidate_name")
        role = event.get("role")

    return bucket, key, candidate_name, role


def extract_clean_text_from_pdf(pdf_bytes: bytes) -> str:
    """Parses PDF bytes using pure-python pypdf (zero binary bloat)."""
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    return "\n\n".join(
        page.extract_text().strip()
        for page in reader.pages
        if page.extract_text() and page.extract_text().strip()
    )


def recursive_split_text(text: str, chunk_size: int = 800, chunk_overlap: int = 100) -> list[str]:
    """Pure-python recursive text splitter (eliminates heavy LangChain dependencies)."""
    separators = ["\n\n", "\n", " ", ""]

    def _split(txt: str, seps: list[str]) -> list[str]:
        if len(txt) <= chunk_size or not seps:
            return [txt.strip()] if txt.strip() else []
        sep = seps[0]
        parts = txt.split(sep) if sep else list(txt)
        chunks, current = [], ""
        for part in parts:
            candidate = f"{current}{sep}{part}" if current else part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    chunks.append(current.strip())
                    current = current[max(0, len(current) - chunk_overlap):] + sep + part if sep else part
                else:
                    chunks.extend(_split(part, seps[1:]))
                    current = ""
        if current.strip():
            chunks.append(current.strip())
        return chunks

    return _split(text, separators)


async def get_embeddings(texts: list[str], client: httpx.AsyncClient) -> list[list[float]]:
    """Generates embeddings via VoyageAI REST API (eliminates heavy SDK dependencies)."""
    voyage_key = (os.getenv("VOYAGE_API") or os.getenv("VOYAGE_API_KEY") or "").strip().strip('"').strip("'")
    if voyage_key:
        model = (os.getenv("EMBEDDING_MODEL") or "voyage-4-large").strip().strip('"').strip("'")
        voyage_url = (os.getenv("VOYAGE_URL") or "https://api.voyageai.com/v1/embeddings").strip().strip('"').strip("'")

        clean_texts = [t.strip() for t in texts if t and t.strip()]
        if not clean_texts:
            return []

        all_embeddings = []
        batch_size = 64
        for i in range(0, len(clean_texts), batch_size):
            batch = clean_texts[i : i + batch_size]
            resp = await client.post(
                voyage_url,
                headers={"Authorization": f"Bearer {voyage_key}", "Content-Type": "application/json"},
                json={"input": batch, "model": model, "input_type": "document"},
                timeout=30.0,
            )
            if resp.status_code != 200:
                print(f"[EMBED ERROR] Voyage API returned status {resp.status_code}: {resp.text}")
                raise ValueError(f"Voyage AI {resp.status_code}: {resp.text}")

            resp_data = resp.json()
            all_embeddings.extend([d["embedding"] for d in resp_data.get("data", [])])

        return all_embeddings

    jina_key = (os.getenv("JINA_API_KEY") or "").strip().strip('"').strip("'")
    if jina_key:
        clean_texts = [t.strip() for t in texts if t and t.strip()]
        if not clean_texts:
            return []
        model = (os.getenv("EMBEDDING_MODEL") or "jina-embeddings-v3").strip().strip('"').strip("'")
        jina_url = (os.getenv("JINA_URL") or "https://api.jina.ai/v1/embeddings").strip().strip('"').strip("'")
        resp = await client.post(
            jina_url,
            headers={"Authorization": f"Bearer {jina_key}", "Content-Type": "application/json"},
            json={"model": model, "input": clean_texts},
            timeout=30.0,
        )
        if resp.status_code != 200:
            print(f"[EMBED ERROR] Jina API returned status {resp.status_code}: {resp.text}")
            raise ValueError(f"Jina AI {resp.status_code}: {resp.text}")
        return [d["embedding"] for d in resp.json()["data"]]

    raise ValueError("No embedding API key found (VOYAGE_API or JINA_API_KEY).")


async def upsert_to_qdrant(
    collection_name: str, chunks: list[dict], vectors: list[list[float]], client: httpx.AsyncClient
) -> int:
    """Ensures collection exists and upserts points via Qdrant Cloud REST API."""
    qdrant_url = (os.getenv("QDRANT_CLUSTER_ENDPOINT") or os.getenv("QDRANT_URL", "")).strip().strip('"').strip("'").rstrip("/")
    qdrant_api_key = (os.getenv("QDRANT_API") or os.getenv("QDRANT_API_KEY") or "").strip().strip('"').strip("'")

    if not qdrant_url:
        raise ValueError("QDRANT_CLUSTER_ENDPOINT not configured.")

    headers = {"api-key": qdrant_api_key, "Content-Type": "application/json"}

    check_resp = await client.get(f"{qdrant_url}/collections/{collection_name}", headers=headers)
    if check_resp.status_code == 404:
        dim = len(vectors[0])
        print(f"[QDRANT] Collection '{collection_name}' not found. Creating with vector dim {dim}...")
        create_resp = await client.put(
            f"{qdrant_url}/collections/{collection_name}",
            headers=headers,
            json={"vectors": {"size": dim, "distance": "Cosine"}},
        )
        if create_resp.status_code not in (200, 201):
            print(f"[QDRANT ERROR] Failed to create collection: {create_resp.text}")
            raise ValueError(f"Qdrant collection creation failed ({create_resp.status_code}): {create_resp.text}")

    points = [
        {
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{c['metadata']['resume_id']}_{c['metadata']['chunk_index']}")),
            "vector": vec,
            "payload": {"page_content": c["page_content"], **c["metadata"]},
        }
        for c, vec in zip(chunks, vectors)
    ]

    upsert_resp = await client.put(
        f"{qdrant_url}/collections/{collection_name}/points?wait=true",
        headers=headers,
        json={"points": points},
        timeout=30.0,
    )
    if upsert_resp.status_code not in (200, 201):
        print(f"[QDRANT ERROR] Upsert failed: {upsert_resp.text}")
        raise ValueError(f"Qdrant upsert failed ({upsert_resp.status_code}): {upsert_resp.text}")

    return len(points)


async def async_handler(event, context=None):
    """Ultralight asynchronous ingestion pipeline."""
    try:
        print(f"[START] Processing event: {json.dumps(event)[:200]}...")
        bucket, key, candidate_name, role = extract_event_info(event)
        print(f"[EVENT] Target bucket: '{bucket}', key: '{key}'")

        if not bucket:
            print("[ERROR] S3 bucket name is missing in event and environment variables!")
            return {
                "statusCode": 400,
                "error": "S3 bucket name is required. Set S3_BUCKET_NAME environment variable or pass bucket in event.",
            }

        if not key:
            print("[ERROR] S3 object key is missing in event!")
            return {"statusCode": 400, "error": "S3 object key is required"}

        s3 = get_s3()
        print(f"[S3] Downloading s3://{bucket}/{key}...")
        try:
            response = await asyncio.to_thread(s3.get_object, Bucket=bucket, Key=key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "NoSuchKey" and ("+" in key or "%" in key or " " in key):
                alt_key = urllib.parse.unquote_plus(key) if "+" in key or "%" in key else key.replace(" ", "+")
                print(f"[S3] Key not found, retrying with decoded key: '{alt_key}'")
                response = await asyncio.to_thread(s3.get_object, Bucket=bucket, Key=alt_key)
                key = alt_key
            else:
                raise

        pdf_bytes = await asyncio.to_thread(response["Body"].read)
        print(f"[S3] Downloaded {len(pdf_bytes)} bytes successfully.")

        text = extract_clean_text_from_pdf(pdf_bytes)
        print(f"[PDF] Extracted {len(text)} characters of text from PDF.")

        if not text.strip():
            print("[PDF] Warning: Document has no extractable text.")
            return {
                "statusCode": 200,
                "resume_id": os.path.basename(key),
                "message": "PDF contains no extractable text (it may be scanned or blank). Skipping embedding.",
            }

        base_name = os.path.basename(key)
        resume_id, filename = (
            base_name.split("_", 1) if "_" in base_name else (base_name, base_name)
        )

        raw_chunks = recursive_split_text(text, chunk_size=800, chunk_overlap=100)
        chunks = []
        offset = 0

        for i, chunk in enumerate(raw_chunks):
            if not chunk.strip():
                continue
            start = text.find(chunk, offset)
            if start != -1:
                offset = start
            meta = {
                "resume_id": resume_id,
                "candidate_id": resume_id,
                "filename": filename,
                "s3_key": key,
                "s3_bucket": bucket,
                "chunk_index": i,
                "total_chunks": len(raw_chunks),
                "char_count": len(chunk),
                "start_char": start,
                "end_char": start + len(chunk) if start != -1 else -1,
            }
            if candidate_name:
                meta["name"] = candidate_name
                meta["candidate_name"] = candidate_name
            if role:
                meta["role"] = role

            chunks.append({"page_content": chunk, "metadata": meta})

        print(f"[CHUNKER] Created {len(chunks)} valid chunks for resume_id: '{resume_id}'")

        if not chunks:
            print("[CHUNKER] Warning: No valid chunks generated from text.")
            return {
                "statusCode": 200,
                "resume_id": resume_id,
                "message": "No valid text chunks generated from document.",
            }

        async with httpx.AsyncClient() as client:
            chunk_texts = [c["page_content"] for c in chunks]
            print(f"[EMBED] Generating embeddings for {len(chunk_texts)} chunks...")
            vectors = await get_embeddings(chunk_texts, client)
            print(f"[EMBED] Generated {len(vectors)} vectors (dimension: {len(vectors[0]) if vectors else 0}).")

            collection = (
                os.getenv("QDRANT_COLLECTION")
                or os.getenv("PRIMARY_KEY")
                or "resumes"
            ).strip().strip('"').strip("'")
            print(f"[QDRANT] Upserting {len(vectors)} points into collection '{collection}'...")
            upserted_count = await upsert_to_qdrant(collection, chunks, vectors, client)
            print(f"[QDRANT] Upserted {upserted_count} points successfully!")

        print(f"[SUCCESS] Resume '{resume_id}' ({filename}) fully ingested.")
        return {
            "statusCode": 200,
            "resume_id": resume_id,
            "filename": filename,
            "collection": collection,
            "total_chunks": len(chunks),
            "vector_dim": len(vectors[0]) if vectors else 0,
            "upserted": upserted_count,
            "message": "Resume successfully ingested and vectorized in Qdrant.",
        }

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "S3Error")
        print(f"[ERROR] AWS ClientError ({error_code}): {str(e)}")
        return {"statusCode": 404 if error_code == "NoSuchKey" else 500, "error": str(e)}
    except Exception as e:
        print(f"[ERROR] Exception: {str(e)}")
        return {"statusCode": 500, "error": str(e)}


def lambda_handler(event, context=None):
    """Synchronous entrypoint for AWS Lambda."""
    return asyncio.run(async_handler(event, context))
