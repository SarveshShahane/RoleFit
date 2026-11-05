from pydantic import BaseModel


class ParsedQuery(BaseModel):
    rewritten_query: str
    keywords: list[str] = []
    exclude_keywords: list[str] = []
    limit: int = 10
    intent: str = "search"


class QueryRequest(BaseModel):
    query: str | None = None
    message: str | None = None
    resume_ids: list[str] | None = None
    limit: int | None = None
    generate: bool = True


class CandidateResponse(BaseModel):
    resume_id: str
    filename: str | None = None
    candidate_name: str | None = None
    role: str | None = None
    top_matched_chunk: str | None = None
    score: float | None = None
    full_resume: str | None = None


class QueryResponse(BaseModel):
    query: str
    rewritten_query: str | None = None
    intent: str = "search"
    total_candidates: int
    candidates: list[CandidateResponse]
    answer: str | None = None
    message: str | None = None
