from fastapi import FastAPI
from fastapi.responses import JSONResponse
import boto3
from botocore.exceptions import ClientError
from core.config import settings
from app.api.routes.resume import router as resume_router

app = FastAPI(title="RoleFit Upload Service")
app.include_router(resume_router)


@app.get("/health")
def health_check():
    tables = boto3.resource(settings.RESOURCE_NAME, region_name=settings.REGION_NAME)
    table_name = settings.TABLE_NAME

    table = tables.Table(table_name)

    try:
        table.load()
        return JSONResponse(content="Table Exists!", status_code=200)
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            raise e
