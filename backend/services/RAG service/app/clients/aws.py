import boto3
from boto3.dynamodb.conditions import Key
from core.config import settings


class AWSClient:
    def __init__(self):
        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=settings.REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.s3 = boto3.client(
            "s3",
            region_name=settings.REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.table = self.dynamodb.Table(settings.TABLE_NAME)

    def generate_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        # Generate inline presigned URL so browser opens PDF directly in a new tab.
        return self.s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": s3_key,
                "ResponseContentType": "application/pdf",
                "ResponseContentDisposition": "inline",
            },
            ExpiresIn=expires_in,
        )

    def extract_meta_from_filename(self, filename: str | None) -> tuple[str, str]:
        if not filename:
            return "Candidate", "Applicant"
        stem = filename.rsplit(".", 1)[0].replace("-", "_")
        parts = stem.split("_")
        name = parts[0].capitalize() if parts else "Candidate"
        role = " ".join(p.capitalize() for p in parts[1:]) if len(parts) > 1 else "Applicant"
        return name, role

    def get_documents(self) -> list[dict]:
        # Query all resume records from DynamoDB partition key.
        response = self.table.query(
            KeyConditionExpression=Key("PK").eq("resume")
        )
        items = response.get("Items", [])
        documents = []
        for item in items:
            s3_key = item.get("s3_key")
            filename = item.get("filename")
            doc_id = str(item.get("SK", ""))
            name, role = self.extract_meta_from_filename(filename)

            pdf_url = None
            if s3_key:
                try:
                    pdf_url = self.generate_presigned_url(s3_key)
                except Exception as e:
                    print(f"[AWS] Failed to generate presigned URL for {s3_key}: {e}")

            documents.append({
                "id": doc_id,
                "resume_id": doc_id,
                "name": name,
                "role": role,
                "filename": filename,
                "s3_key": s3_key,
                "pdf_url": pdf_url,
                "uploaded_at": item.get("uploaded_at"),
            })

        return documents


aws_client = AWSClient()

