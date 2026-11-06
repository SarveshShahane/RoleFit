from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse
from app.service.rag import stream_candidate_search, list_resumes
from app.schemas.rag import ChatRequest, ResumeListResponse, DocumentItem

router = APIRouter(
    prefix="/api",
    tags=["rag"],
)


@router.get("/documents", response_model=list[DocumentItem])
def get_documents():
    try:
        return list_resumes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch documents: {str(e)}")


@router.get("/resumes", response_model=ResumeListResponse)
def get_resumes():
    try:
        return {"resumes": list_resumes()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resumes: {str(e)}")


@router.post("/chat")
@router.post("/chat/stream")
def chat_stream(request: ChatRequest = Body(...)):
    query_text = (request.query or request.message or "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query or message is required.")

    try:
        generator = stream_candidate_search(
            query=query_text,
            resume_ids=request.resume_ids,
            limit=request.limit,
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming error: {str(e)}")
