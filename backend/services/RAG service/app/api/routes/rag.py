from fastapi import APIRouter, Query, HTTPException, Body
from fastapi.responses import StreamingResponse
from app.service.rag import retrieve_candidates, retrieve_candidates_stream, list_resumes
from app.schemas.rag import QueryRequest, QueryResponse, ResumeListResponse

router = APIRouter(
    prefix="/api",
    tags=["rag"],
)


@router.get("/resumes", response_model=ResumeListResponse)
def get_resumes():
    # Return list of indexed candidates for candidate selection filter.
    try:
        return {"resumes": list_resumes()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resumes: {str(e)}")


@router.post("/chat/stream")
def chat_stream(request: QueryRequest = Body(...)):
    # Stream token chunks and candidate metadata via Server-Sent Events.
    query_text = (request.query or request.message or "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query or message is required.")

    try:
        generator = retrieve_candidates_stream(
            query=query_text,
            resume_ids=request.resume_ids,
            limit=request.limit,
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming error: {str(e)}")


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
