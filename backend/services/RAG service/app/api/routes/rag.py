from fastapi import APIRouter, Query, HTTPException
from app.clients.voyage import voyage_client
from app.clients.qdrantdb import qdrantdb_client
router = APIRouter(
    prefix="/api",
    tags=["rag"],
)


@router.get("/query")
def query_function(
    query: str = Query(..., description="Job description or search query")
):
    try:
        # Embed query with Voyage AI (input_type="query")
        query_vector = voyage_client.embed_query(query)
        # qdrant_client=
        result = qdrantdb_client.similarity_search(query=query_vector)
        return {
            "query": query,
            "vector_dimension": len(query_vector),
            "message": "Query embedded successfully",
            "result":result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate embedding: {str(e)}"
        )
