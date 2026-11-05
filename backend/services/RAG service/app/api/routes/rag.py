from fastapi import APIRouter, Query, HTTPException, Body
from app.service.rag import retrieve_candidates
from app.schemas.rag import QueryRequest, QueryResponse

router = APIRouter(
    prefix="/api",
    tags=["rag"],
)


@router.post("/query", response_model=QueryResponse)
@router.post("/chat", response_model=QueryResponse)
def query_post(request: QueryRequest = Body(...)):
    # Run candidate retrieval and augmented generation for a query.
    query_text = (request.query or request.message or "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query or message is required.")

    try:
        return retrieve_candidates(
            query=query_text,
            resume_ids=request.resume_ids,
            limit=request.limit,
            generate=request.generate,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG error: {str(e)}")


@router.get("/query", response_model=QueryResponse)
def query_get(
    query: str = Query(..., description="Job description or search query"),
    resume_ids: list[str] | None = Query(None, description="Optional resume IDs to scope search"),
    limit: int | None = Query(None, description="Max candidates to return (e.g. 25)"),
    generate: bool = Query(True, description="Whether to run augmented generation"),
):
    # Support GET requests for simple browser queries.
    try:
        return retrieve_candidates(
            query=query,
            resume_ids=resume_ids,
            limit=limit,
            generate=generate,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG error: {str(e)}")
