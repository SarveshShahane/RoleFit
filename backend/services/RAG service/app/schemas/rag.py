from pydantic import BaseModel


class ParsedQuery(BaseModel):
    rewritten_query: str
    target_role: str | None = None
    required_skills: list[str] = []
    keywords: list[str] = []
    exclude_keywords: list[str] = []
    limit: int = 10
    intent: str = "search"


class ChatRequest(BaseModel):
    query: str | None = None
    message: str | None = None
    resume_ids: list[str] | None = None
    limit: int | None = None
    generate: bool | None = None


QueryRequest = ChatRequest


class CandidateResponse(BaseModel):
    resume_id: str
    filename: str | None = None
    candidate_name: str | None = None
    role: str | None = None
    top_matched_chunk: str | None = None
    score: float | None = None
    full_resume: str | None = None
    s3_key: str | None = None
    pdf_url: str | None = None


class DocumentItem(BaseModel):
    id: str
    resume_id: str
    name: str | None = None
    role: str | None = None
    filename: str | None = None
    s3_key: str | None = None
    pdf_url: str | None = None
    uploaded_at: str | None = None


class ResumeListResponse(BaseModel):
    resumes: list[DocumentItem]
