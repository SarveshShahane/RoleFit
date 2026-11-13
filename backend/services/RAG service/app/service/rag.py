import json
import re
from rank_bm25 import BM25Okapi
from qdrant_client import models
from core.config import settings
from app.clients.qdrantdb import qdrantdb_client
from app.clients.voyage import voyage_client
from app.clients.llm import llm_client
from app.clients.aws import aws_client
from app.schemas.rag import ParsedQuery


def compute_bm25_scores(query: str, docs: list[str]) -> list[float]:
    if not docs:
        return []

    tokenized_query = [t.lower() for t in query.split() if t.strip()]
    if not tokenized_query:
        return [0.0] * len(docs)

    tokenized_corpus = [[t.lower() for t in doc.split() if t.strip()] for doc in docs]
    bm25 = BM25Okapi(tokenized_corpus)
    return [float(s) for s in bm25.get_scores(tokenized_query)]


def rerank(query: str, candidates: list[dict], top_n: int = 15) -> list[dict]:
    if not candidates:
        return []
    try:
        doc_texts = [c["text"] for c in candidates]
        res = voyage_client.client.rerank(
            query=query,
            documents=doc_texts,
            model="rerank-2",
            top_k=min(top_n, len(doc_texts)),
        )
        ranked = []
        for r in res.results:
            c = candidates[r.index].copy()
            score = float(r.relevance_score)
            c["rerank_score"] = score
            c["score"] = score
            ranked.append(c)
        return ranked
    except Exception as e:
        print(f"[RERANK] Voyage rerank error, fallback to score sorting: {e}")
        return sorted(candidates, key=lambda x: x.get("combined_score", x.get("score", 0.0)), reverse=True)[:top_n]


def candidate_matches(c: dict, target_role: str | None, required_skills: list[str]) -> bool:
    text_lower = (c.get("text") or "").lower()

    if target_role:
        tr = target_role.lower().strip()
        if "product manager" in tr:
            if not re.search(r'\bproduct\s+manager\b|\bproduct\s+management\b', text_lower):
                return False
        elif "project manager" in tr:
            if not re.search(r'\bproject\s+manager\b|\bproject\s+management\b', text_lower):
                return False
        elif "scrum master" in tr:
            if not re.search(r'\bscrum\s+master\b', text_lower):
                return False
        elif "python" in tr:
            if not re.search(r'\bpython\b', text_lower):
                return False
        elif "java" in tr:
            if not re.search(r'\bjava\b', text_lower):
                return False
        elif "php" in tr:
            if not re.search(r'\bphp\b', text_lower):
                return False
        elif "hadoop" in tr:
            if not re.search(r'\bhadoop\b', text_lower):
                return False
        else:
            clean_tr_words = [w for w in re.findall(r'[a-zA-Z0-9+#]+', tr) if w not in ["developer", "engineer", "lead", "specialist"]]
            if clean_tr_words:
                if not any(re.search(r'\b' + re.escape(w) + r'\b', text_lower) for w in clean_tr_words):
                    return False

    if required_skills:
        hard_skills = [
            s.lower().strip() for s in required_skills
            if s.lower().strip() in [
                "python", "java", "php", "golang", "c++", "c#", "ruby", "rust",
                "node.js", "nodejs", "node js", "node", "react", "angular", "vue",
                "aws", "docker", "kubernetes", "django", "fastapi", "spring boot",
                "spring", "hadoop", "spark"
            ]
        ]
        for sk in hard_skills:
            if sk in ["node.js", "nodejs", "node js", "node"]:
                if not re.search(r'\bnode(\.js|\s+js)?\b', text_lower):
                    return False
            elif sk in ["spring boot", "spring"]:
                if not re.search(r'\bspring(\s+boot)?\b', text_lower):
                    return False
            else:
                if not re.search(r'\b' + re.escape(sk) + r'\b', text_lower):
                    return False

    return True


def filter_relevant_candidates(parsed: ParsedQuery, candidates: list[dict]) -> list[dict]:
    if not candidates:
        return []

    top_score = candidates[0].get("score", 0.0) if candidates else 0.0
    filtered = []

    for c in candidates:
        score = c.get("score", 0.0)

        if not candidate_matches(c, parsed.target_role, parsed.required_skills):
            continue

        if score < 0.28:
            continue

        if top_score > 0.40 and score < (top_score * 0.55):
            continue

        filtered.append(c)

    return filtered


def extract_candidate_meta(payload: dict) -> tuple[str, str]:
    name = payload.get("name") or payload.get("candidate_name")
    role = payload.get("role")
    filename = payload.get("filename")

    if (not name or not role) and filename:
        stem = filename.rsplit(".", 1)[0].replace("-", "_")
        parts = stem.split("_")
        if not name and parts:
            name = parts[0].capitalize()
        if not role and len(parts) > 1:
            role = " ".join(p.capitalize() for p in parts[1:])

    return name or "Candidate", role or "Applicant"


def get_parent_resume(resume_id: str, filename: str | None = None) -> dict:
    points, _ = qdrantdb_client.client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        scroll_filter=models.Filter(
            must=[models.FieldCondition(key="resume_id", match=models.MatchValue(value=resume_id))]
        ),
        limit=100,
        with_payload=True,
    )
    if not points and filename:
        try:
            all_pts, _ = qdrantdb_client.client.scroll(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                limit=300,
                with_payload=True,
            )
            clean_fn = filename.lower().strip()
            points = [p for p in all_pts if (p.payload or {}).get("filename", "").lower().strip() == clean_fn]
        except Exception as e:
            print(f"[QDRANT] Fallback filename scroll failed: {e}")

    if not points:
        return {"full_resume": "", "filename": None, "name": None, "role": None, "s3_key": None}

    sorted_chunks = sorted(points, key=lambda p: p.payload.get("chunk_index", 0))
    full_text = "\n\n".join(p.payload.get("page_content", "") for p in sorted_chunks)
    meta = sorted_chunks[0].payload
    name, role = extract_candidate_meta(meta)
    return {
        "full_resume": full_text,
        "filename": meta.get("filename"),
        "name": name,
        "role": role,
        "s3_key": meta.get("s3_key"),
    }


def list_resumes() -> list[dict]:
    try:
        docs = aws_client.get_documents()
        if docs:
            return docs
    except Exception as e:
        print(f"[AWS] Failed to fetch resumes from DynamoDB: {e}")

    points, _ = qdrantdb_client.client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        limit=250,
        with_payload=True,
    )
    seen = {}
    for p in points:
        payload = p.payload or {}
        rid = payload.get("resume_id")
        if rid and rid not in seen:
            name, role = extract_candidate_meta(payload)
            s3_key = payload.get("s3_key")
            pdf_url = aws_client.generate_presigned_url(s3_key) if s3_key else None
            seen[rid] = {
                "id": str(rid),
                "resume_id": str(rid),
                "filename": payload.get("filename"),
                "name": name,
                "role": role,
                "s3_key": s3_key,
                "pdf_url": pdf_url,
            }
    return list(seen.values())


def stream_candidate_search(
    query: str,
    resume_ids: list[str] | None = None,
    limit: int | None = None,
):
    parsed: ParsedQuery = llm_client.parse_query(query)
    effective_limit = limit if limit is not None else parsed.limit

    if parsed.intent == "general" and not resume_ids:
        yield f"data: {json.dumps({'type': 'metadata', 'candidates': [], 'query': query, 'intent': 'general'})}\n\n"
        for chunk in llm_client.stream_answer(query=query, candidates=[], intent="general"):
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    if resume_ids:
        cand_items = []
        doc_list = []
        try:
            doc_list = aws_client.get_documents()
        except Exception as e:
            print(f"[AWS] Failed to list documents for scoped lookup: {e}")

        for rid in resume_ids:
            doc_meta = next((d for d in doc_list if d.get("id") == rid or d.get("resume_id") == rid), None)
            fn = doc_meta.get("filename") if doc_meta else None

            parent_data = get_parent_resume(rid, filename=fn)
            full_text = parent_data.get("full_resume") or ""
            if not full_text:
                continue

            name = parent_data.get("name") or (doc_meta.get("name") if doc_meta else None) or "Candidate"
            role = parent_data.get("role") or (doc_meta.get("role") if doc_meta else None) or "Applicant"
            s3_key = parent_data.get("s3_key") or (doc_meta.get("s3_key") if doc_meta else None)
            filename = parent_data.get("filename") or fn
            pdf_url = aws_client.generate_presigned_url(s3_key) if s3_key else None
            preview = full_text[:400] + ("..." if len(full_text) > 400 else "")

            cand_items.append({
                "resume_id": rid,
                "filename": filename,
                "candidate_name": name,
                "role": role,
                "top_matched_chunk": preview,
                "score": 1.0,
                "full_resume": full_text,
                "s3_key": s3_key,
                "pdf_url": pdf_url,
            })

        if not cand_items:
            yield f"data: {json.dumps({'type': 'metadata', 'candidates': [], 'query': query, 'intent': 'scoped'})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'content': 'Selected candidate resumes could not be found in the database.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        scoped_intent = "deep_dive" if len(cand_items) == 1 else "comparison"
        yield f"data: {json.dumps({'type': 'metadata', 'candidates': cand_items, 'query': query, 'intent': scoped_intent})}\n\n"
        for chunk in llm_client.stream_answer(query=query, candidates=cand_items, intent=scoped_intent):
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    qdrant_filter = None
    if resume_ids:
        qdrant_filter = models.Filter(
            must=[models.FieldCondition(key="resume_id", match=models.MatchAny(any=resume_ids))]
        )

    search_text = parsed.rewritten_query or query
    query_vector = voyage_client.embed_query(search_text)
    fetch_limit = max(25, effective_limit * 3)
    groups = qdrantdb_client.group_search(
        query=query_vector,
        group_by="resume_id",
        limit=fetch_limit,
        group_size=2,
        query_filter=qdrant_filter,
    )
    if not groups:
        yield f"data: {json.dumps({'type': 'metadata', 'candidates': [], 'query': query, 'intent': parsed.intent})}\n\n"
        for chunk in llm_client.stream_answer(query=query, candidates=[], intent=parsed.intent):
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    candidate_items = []
    seen_keys = set()
    for group in groups:
        rid = str(group.id)
        best_hit = group.hits[0]
        evidence_text = "\n\n".join(h.payload.get("page_content", "") for h in group.hits)

        if parsed.exclude_keywords:
            text_lower = evidence_text.lower()
            if any(ex in text_lower for ex in parsed.exclude_keywords):
                continue

        name, role = extract_candidate_meta(best_hit.payload)
        name_key = (name or "").strip().lower()
        role_key = (role or "").strip().lower()
        fname_key = (best_hit.payload.get("filename") or "").strip().lower()
        key = (name_key, role_key)
        if key in seen_keys or (fname_key and fname_key in seen_keys):
            continue
        seen_keys.add(key)
        if fname_key:
            seen_keys.add(fname_key)

        candidate_items.append({
            "resume_id": rid,
            "filename": best_hit.payload.get("filename"),
            "name": name,
            "role": role,
            "text": evidence_text,
            "score": best_hit.score or 0.0,
            "s3_key": best_hit.payload.get("s3_key"),
        })

    if not candidate_items:
        yield f"data: {json.dumps({'type': 'metadata', 'candidates': [], 'query': query, 'intent': parsed.intent})}\n\n"
        for chunk in llm_client.stream_answer(query=query, candidates=[], intent=parsed.intent):
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    bm25_query = " ".join(parsed.keywords) if parsed.keywords else search_text
    docs_text = [c["text"] for c in candidate_items]
    bm25_scores = compute_bm25_scores(bm25_query, docs_text)
    max_bm25 = max(bm25_scores) if max(bm25_scores, default=0) > 0 else 1.0

    for i, c in enumerate(candidate_items):
        c["combined_score"] = 0.7 * c["score"] + 0.3 * (bm25_scores[i] / max_bm25)

    candidate_items.sort(key=lambda x: x["combined_score"], reverse=True)
    reranked = rerank(search_text, candidate_items, top_n=min(15, len(candidate_items)))

    filtered_candidates = filter_relevant_candidates(parsed, reranked)[:effective_limit]

    is_comparison = bool(re.search(r'\b(compare|comparison|versus|vs|difference|between)\b', query, re.I))
    if is_comparison and len(filtered_candidates) < 2 and len(reranked) >= 2:
        filtered_candidates = reranked[:2]

    include_full = effective_limit <= 5 or is_comparison
    results = []
    for c in filtered_candidates:
        full_text = None
        if include_full:
            parent_data = get_parent_resume(c["resume_id"])
            full_text = parent_data.get("full_resume")

        s3_key = c.get("s3_key")
        pdf_url = None
        if s3_key:
            try:
                pdf_url = aws_client.generate_presigned_url(s3_key)
            except Exception:
                pass

        results.append({
            "resume_id": c["resume_id"],
            "filename": c.get("filename"),
            "candidate_name": c.get("name"),
            "role": c.get("role"),
            "top_matched_chunk": c["text"],
            "score": round(c.get("score", 0.0), 4),
            "full_resume": full_text,
            "s3_key": s3_key,
            "pdf_url": pdf_url,
        })

    yield f"data: {json.dumps({'type': 'metadata', 'candidates': results, 'query': query, 'intent': parsed.intent})}\n\n"

    for chunk in llm_client.stream_answer(query=query, candidates=results, intent=parsed.intent):
        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


retrieve_candidates_stream = stream_candidate_search
