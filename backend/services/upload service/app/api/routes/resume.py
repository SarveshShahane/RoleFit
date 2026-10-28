import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, File, HTTPException, UploadFile

from core.config import settings
from app.clients.object_storage import object_storage

from app.clients.dynamo_db import db


router = APIRouter(prefix="/api/upload", tags=["upload"])

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(
        (".pdf", ".docx", ".doc", ".txt")
    ):
        raise HTTPException(status_code=400, detail="Invalid file type")

    file_id = str(uuid.uuid4())
    s3_key = object_storage.upload(file.file, file.filename)

    item = {
        'PK':'resume',
        "SK": file_id,
        "filename": file.filename,
        "s3_key": s3_key,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    db.put_obj(item)

    return {"message": "Upload successful", "data": item}
