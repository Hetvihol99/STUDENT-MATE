"""
Keyword-based retrieval — mirrors server/services.ts retrieve() exactly.

Selects up to 6 chunks from up to 500 candidates using term-overlap scoring.
This is lexical retrieval, not semantic/vector search.
"""
import re
from typing import Any

STOP_WORDS = set(
    "a an the is are to of in on for and or what how explain give me "
    "this that my notes with does do it".split()
)


def retrieve(query: str, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Score each evidence chunk by how many query terms appear in its text.
    Returns top-6 chunks with score > 0.
    """
    raw_terms = re.findall(r"[a-z0-9]{2,}", query.lower())
    terms = list(dict.fromkeys(t for t in raw_terms if t not in STOP_WORDS))

    if not terms:
        return []

    scored = []
    for chunk in evidence[:500]:
        text_lower = chunk["text"].lower()
        score = sum(1 for t in terms if t in text_lower)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:6]]
