from core.config import settings
from qdrant_client import QdrantClient, models


class QdrantDBClient:
    def __init__(self):
        self.client = QdrantClient(
            url=settings.QDRANT_CLUSTER_ENDPOINT,
            api_key=settings.QDRANT_API,
            check_compatibility=False,
        )
        self._ensure_payload_index()

    def _ensure_payload_index(self):
        # Create a payload index on resume_id for group queries.
        try:
            self.client.create_payload_index(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                field_name="resume_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
        except Exception:
            pass

    def group_search(
        self,
        query: list[float],
        group_by: str = "resume_id",
        limit: int = 10,
        group_size: int = 2,
        query_filter: models.Filter | None = None,
    ):
        # Search chunks grouped by candidate to prevent duplicate resumes.
        result = self.client.query_points_groups(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            query=query,
            group_by=group_by,
            query_filter=query_filter,
            limit=limit,
            group_size=group_size,
            with_payload=True,
        )
        return result.groups


qdrantdb_client = QdrantDBClient()
