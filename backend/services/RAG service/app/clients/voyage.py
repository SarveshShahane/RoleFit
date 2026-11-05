import voyageai
from core.config import settings


class VoyageClient:
    def __init__(self):
        self.client = voyageai.Client(api_key=settings.VOYAGE_API)
        self.model = settings.EMBEDDING_MODEL

    def embed_query(self, query: str) -> list[float]:
        clean_query = query.strip()
        if not clean_query:
            raise ValueError("Query string cannot be empty.")

        response = self.client.embed(
            texts=[clean_query],
            model=self.model,
            input_type="query",
        )
        return response.embeddings[0]

voyage_client = VoyageClient()

