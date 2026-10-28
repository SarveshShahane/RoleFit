from pathlib import Path
import os
import boto3
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self):
        self.REGION_NAME: str = os.getenv("REGION_NAME")
        self.RESOURCE_NAME: str = os.getenv("RESOURCE_NAME")
        self.TABLE_NAME: str = os.getenv("TABLE_NAME")
        self.BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME")

        self.PRIMARY_KEY: str = os.getenv("PRIMARY_KEY")

 


settings = Settings()
