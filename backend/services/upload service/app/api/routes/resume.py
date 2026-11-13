import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, File, UploadFile
from botocore.exceptions import ClientError
from app.clients.object_storage import object_storage
from fastapi.responses import JSONResponse
from app.clients.dynamo_db import db

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
@router.post("/")
def upload_file(files: list[UploadFile] = File(...)):

    success_count = 0
    total_documents = len(files)
    result = [
        {"id": idx, "filename": file.filename, "status": "pending", "error": None}
        for idx, file in enumerate(files)
    ]
    for idx, file in enumerate(files):
        if not file.filename or not file.filename.lower().endswith(
            (".pdf", ".docx", ".doc", ".txt")
        ):
            result[idx]["status"] = "failed"
            result[idx]["error"] = {
                "error_code": 400,
                "error_message": "Invalid file type",
            }
            continue

        file_id = str(uuid.uuid4())
        try:
            
            s3_key = object_storage.upload(file.file, file.filename,file_id)
        except ClientError as e:
            result[idx]["error"] = {
                            "error_code": e.response["Error"]["Code"],
                            "error_message": e.response["Error"]["Message"],
                        }
            result[idx]["status"] = "failed"
            continue
        result[idx]["file_id"] = file_id
        result[idx]["s3_key"] = s3_key
        item = {
            "PK": "resume",
            "SK": file_id,
            "filename": file.filename,
            "s3_key": s3_key,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            db.put_obj(item)
            result[idx]["status"] = "success"
            success_count += 1
        except ClientError as e:
            result[idx]["error"] = {
                "error_code": e.response["Error"]["Code"],
                "error_message": e.response["Error"]["Message"],
            }
            result[idx]["status"] = "failed"

    response = {
        "total documents": total_documents,
        "successful uploads": success_count,
        "failed uploads": total_documents - success_count,
        "result": result,
    }

    return JSONResponse(content=response, status_code=200)
