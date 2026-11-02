from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self):
        self.GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        self.LLM_MODEL = os.getenv("LLM_MODEL")
        self.REGION_NAME = os.getenv("REGION_NAME")
        self.RESOURCE_NAME = os.getenv("RESOURCE_NAME")
        self.TABLE_NAME = os.getenv("TABLE_NAME")
        self.S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
        self.PRIMARY_KEY = os.getenv("PRIMARY_KEY")
        self.QDRANT_API = os.getenv("QDRANT_API")
        self.QDRANT_CLUSTER_ENDPOINT = os.getenv("QDRANT_CLUSTER_ENDPOINT")
        self.JINA_API_KEY = os.getenv("JINA_API_KEY")
        self.JINA_URL = os.getenv("JINA_URL")
        self.VOYAGE_API = os.getenv("VOYAGE_API")
        self.EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "voyage-4-large")
        self.QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")


settings = Settings()
