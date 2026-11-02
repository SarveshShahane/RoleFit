from core.config import settings
from qdrant_client import QdrantClient
from langchain_core.documents import Document
class QdrantDBClient:
    def __init__(self):
        self.QDRANT_API = settings.QDRANT_API
        self.QDRANT_CLUSTER_ENDPOINT=settings.QDRANT_CLUSTER_ENDPOINT
        self.QDRANT_COLLECTION_NAME = settings.QDRANT_COLLECTION_NAME
        self.client = QdrantClient(url=settings.QDRANT_CLUSTER_ENDPOINT, api_key=settings.QDRANT_API)
        
    def similarity_search(self,query:list[float])->list[Document]:
       result = self.client.query_points(
            collection_name = self.QDRANT_COLLECTION_NAME,
            query= query,
            limit=10
        )
       return result
   
   
qdrantdb_client=QdrantDBClient()