from rank_bm25 import BM25Okapi
from qdrant_client import models
from core.config import settings
from app.clients.qdrantdb import qdrantdb_client
from app.clients.voyage import voyage_client
from app.clients.llm import llm_client
from app.schemas.rag import ParsedQuery


def compute_bm25_scores(query: str, docs: list[str]) -> list[float]:
    # Calculate BM25 keyword scores across candidate texts.
    if not docs:
        return []

    tokenized_query = [t.lower() for t in query.split() if t.strip()]
    if not tokenized_query:
        return [0.0] * len(docs)

    tokenized_corpus = [[t.lower() for t in doc.split() if t.strip()] for doc in docs]
    bm25 = BM25Okapi(tokenized_corpus)
    return [float(s) for s in bm25.get_scores(tokenized_query)]


def rerank(query: str, candidates: list[dict], top_n: int = 10) -> list[dict]:
    # Rerank candidates with Voyage cross-encoder, fallback to vector score.
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
        return [candidates[r.index] for r in res.results]
    except Exception as e:
        print(f"[RERANK] Voyage rerank error, fallback to score sorting: {e}")
        return sorted(candidates, key=lambda x: x.get("combined_score", x.get("score", 0.0)), reverse=True)[:top_n]


def extract_candidate_meta(payload: dict) -> tuple[str, str]:
    # Extract candidate name and role from metadata or file stem.
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


def get_parent_resume(resume_id: str) -> dict:
    # Reconstruct full resume text by sorting chunks from Qdrant.
    points, _ = qdrantdb_client.client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        scroll_filter=models.Filter(
            must=[models.FieldCondition(key="resume_id", match=models.MatchValue(value=resume_id))]
        ),
        limit=100,
        with_payload=True,
    )
    if not points:
        return {"full_resume": "", "filename": None, "name": None, "role": None}

    sorted_chunks = sorted(points, key=lambda p: p.payload.get("chunk_index", 0))
    full_text = "\n\n".join(p.payload.get("page_content", "") for p in sorted_chunks)
    meta = sorted_chunks[0].payload
    name, role = extract_candidate_meta(meta)
    return {
        "full_resume": full_text,
        "filename": meta.get("filename"),
        "name": name,
        "role": role,
    }


def retrieve_candidates(
    query: str,
    resume_ids: list[str] | None = None,
    limit: int | None = None,
    generate: bool = True,
) -> dict:
    # Parse query into keywords, exclusions, dynamic limit, and intent.
    parsed: ParsedQuery = llm_client.parse_query(query)
    effective_limit = limit if limit is not None else parsed.limit

    # Return early for conversational greetings.
    if parsed.intent == "general" and not resume_ids:
        msg = "Hello! I am your ATS assistant. Ask me to find candidates (e.g. 'Top 25 Java Developers with AWS') or paste a Job Description."
        return {
            "query": query,
            "rewritten_query": parsed.rewritten_query,
            "intent": "general",
            "total_candidates": 0,
            "candidates": [],
            "answer": msg,
            "message": msg,
        }

    # Fast path for single candidate lookup.
    if resume_ids and len(resume_ids) == 1:
        rid = resume_ids[0]
        parent_data = get_parent_resume(rid)
        if not parent_data["full_resume"]:
            not_found_msg = f"Resume '{rid}' was not found in the database."
            return {
                "query": query,
                "rewritten_query": parsed.rewritten_query,
                "intent": "deep_dive",
                "total_candidates": 0,
                "candidates": [],
                "answer": not_found_msg,
                "message": not_found_msg,
            }
        preview = parent_data["full_resume"][:400] + ("..." if len(parent_data["full_resume"]) > 400 else "")
        cand_item = {
            "resume_id": rid,
            "filename": parent_data["filename"],
            "candidate_name": parent_data["name"],
            "role": parent_data["role"],
            "top_matched_chunk": preview,
            "score": 1.0,
            "full_resume": parent_data["full_resume"],
        }
        answer = None
        if generate:
            answer = llm_client.generate_answer(query=query, candidates=[cand_item], intent="deep_dive")

        return {
            "query": query,
            "rewritten_query": parsed.rewritten_query,
            "intent": "deep_dive",
            "total_candidates": 1,
            "candidates": [cand_item],
            "answer": answer,
            "message": answer,
        }

    # Filter search by resume IDs when provided.
    qdrant_filter = None
    if resume_ids:
        qdrant_filter = models.Filter(
            must=[models.FieldCondition(key="resume_id", match=models.MatchAny(any=resume_ids))]
        )

    # Embed search query with Voyage.
    search_text = parsed.rewritten_query or query
    query_vector = voyage_client.embed_query(search_text)

    # Query Qdrant grouped by resume ID to return unique candidates.
    groups = qdrantdb_client.group_search(
        query=query_vector,
        group_by="resume_id",
        limit=effective_limit,
        group_size=2,
        query_filter=qdrant_filter,
    )
    if not groups:
        no_res_msg = f"No candidate resumes in the database matched your criteria for: '{query}'."
        return {
            "query": query,
            "rewritten_query": search_text,
            "intent": parsed.intent,
            "total_candidates": 0,
            "candidates": [],
            "answer": no_res_msg,
            "message": no_res_msg,
        }

    # Extract evidence and skip candidates with excluded keywords.
    candidate_items = []
    for group in groups:
        rid = str(group.id)
        best_hit = group.hits[0]
        evidence_text = "\n\n".join(h.payload.get("page_content", "") for h in group.hits)

        if parsed.exclude_keywords:
            text_lower = evidence_text.lower()
            if any(ex in text_lower for ex in parsed.exclude_keywords):
                continue

        name, role = extract_candidate_meta(best_hit.payload)
        candidate_items.append({
            "resume_id": rid,
            "filename": best_hit.payload.get("filename"),
            "name": name,
            "role": role,
            "text": evidence_text,
            "score": best_hit.score or 0.0,
        })

    if not candidate_items:
        no_cand_msg = f"No candidate resumes in the database matched your criteria for: '{query}'."
        return {
            "query": query,
            "rewritten_query": search_text,
            "intent": parsed.intent,
            "total_candidates": 0,
            "candidates": [],
            "answer": no_cand_msg,
            "message": no_cand_msg,
        }

    # Score candidate evidence with BM25 keyword matching.
    bm25_query = " ".join(parsed.keywords) if parsed.keywords else search_text
    docs_text = [c["text"] for c in candidate_items]
    bm25_scores = compute_bm25_scores(bm25_query, docs_text)
    max_bm25 = max(bm25_scores) if max(bm25_scores, default=0) > 0 else 1.0

    # Combine vector score with BM25 keyword score.
    for i, c in enumerate(candidate_items):
        c["combined_score"] = 0.7 * c["score"] + 0.3 * (bm25_scores[i] / max_bm25)

    candidate_items.sort(key=lambda x: x["combined_score"], reverse=True)

    # Rerank candidates using Voyage reranker.
    reranked = rerank(search_text, candidate_items, top_n=effective_limit)

    # Attach full resume text only for small result sets.
    include_full = effective_limit <= 5
    results = []

    for c in reranked:
        full_text = None
        if include_full:
            parent_data = get_parent_resume(c["resume_id"])
            full_text = parent_data.get("full_resume")

        results.append({
            "resume_id": c["resume_id"],
            "filename": c.get("filename"),
            "candidate_name": c.get("name"),
            "role": c.get("role"),
            "top_matched_chunk": c["text"],
            "score": round(c.get("combined_score", c.get("score", 0.0)), 4),
            "full_resume": full_text,
        })

    # Generate ATS answer based on candidate evidence.
    answer = None
    if generate:
        answer = llm_client.generate_answer(query=query, candidates=results, intent=parsed.intent)

    return {
        "query": query,
        "rewritten_query": search_text,
        "intent": parsed.intent,
        "total_candidates": len(results),
        "candidates": results,
        "answer": answer,
        "message": answer,
    }
