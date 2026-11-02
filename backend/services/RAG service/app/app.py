from fastapi import FastAPI
from app.api.routes.rag import router as rag_router
app = FastAPI(title="RoleFit -  RAG Service")

app.include_router(rag_router)
@app.get('/')
def home():
    return "Welcome to RAG service"