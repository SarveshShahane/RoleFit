from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.rag import router as rag_router

app = FastAPI(title="RoleFit - RAG Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rag_router)


@app.get("/")
def home():
    return "Welcome to RAG service"
