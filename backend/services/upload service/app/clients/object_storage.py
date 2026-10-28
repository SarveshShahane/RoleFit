import uuid
import boto3
from core.config import settings

class ObjectStorage:
    def __init__(self):
        self.s3 = boto3.client("s3", region_name=settings.REGION_NAME)
        self.bucket = settings.BUCKET_NAME

    def upload(self, file_obj, filename: str) -> str:
        key = f"resumes/{uuid.uuid4()}_{filename}"
        self.s3.upload_fileobj(file_obj, self.bucket, key)
        return key


object_storage = ObjectStorage()
