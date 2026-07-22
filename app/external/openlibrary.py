import httpx

SEARCH_URL = "https://openlibrary.org/search.json"
COVER_URL = "https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"


async def search_books(query: str, limit: int = 10) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(SEARCH_URL, params={"q": query, "limit": limit})
        resp.raise_for_status()
        data = resp.json()

    results = []
    for doc in data.get("docs", []):
        cover_id = doc.get("cover_i")
        isbns = doc.get("isbn") or []
        results.append(
            {
                "openlibrary_id": doc.get("key", "").replace("/works/", ""),
                "title": doc.get("title", ""),
                "author": ", ".join(doc.get("author_name", []) or []),
                "publish_date": str(doc.get("first_publish_year", "") or ""),
                "isbn": isbns[0] if isbns else "",
                "cover": COVER_URL.format(cover_id=cover_id) if cover_id else "",
                "publisher": (doc.get("publisher") or [""])[0],
                "pages": doc.get("number_of_pages_median"),
                "genre": ", ".join((doc.get("subject") or [])[:3]),
            }
        )
    return results
