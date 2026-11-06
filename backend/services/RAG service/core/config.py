from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _get_required_env(key: str) -> str:
    val = os.getenv(key)
    if not val or not val.strip():
        raise ValueError(f"Missing required environment variable: {key}")
    return val.strip().strip('"').strip("'")


class Settings:
    def __init__(self):
        self.GROQ_API_KEY: str = _get_required_env("GROQ_API_KEY")
        self.LLM_MODEL: str = _get_required_env("LLM_MODEL")
        self.QDRANT_API: str = _get_required_env("QDRANT_API")
        self.QDRANT_CLUSTER_ENDPOINT: str = _get_required_env("QDRANT_CLUSTER_ENDPOINT")
        self.QDRANT_COLLECTION_NAME: str = _get_required_env("QDRANT_COLLECTION_NAME")
        self.VOYAGE_API: str = _get_required_env("VOYAGE_API")
        self.EMBEDDING_MODEL: str = _get_required_env("EMBEDDING_MODEL")
        self.AWS_ACCESS_KEY_ID: str = _get_required_env("AWS_ACCESS_KEY_ID")
        self.AWS_SECRET_ACCESS_KEY: str = _get_required_env("AWS_SECRET_ACCESS_KEY")
        self.REGION_NAME: str = _get_required_env("REGION_NAME")
        self.TABLE_NAME: str = _get_required_env("TABLE_NAME")
        self.S3_BUCKET_NAME: str = _get_required_env("S3_BUCKET_NAME")


settings = Settings()
