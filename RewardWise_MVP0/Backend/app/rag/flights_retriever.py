"""
Flights RAG Retriever
=====================
BM25-style keyword retriever over the FlightWise knowledge base.
Drop-in replacement (or companion) for the original reward-card retriever.

Supports:
  - Full-text BM25 retrieval across all documents
  - Category filtering (points_vs_cash | airline_programs | credit_cards | booking_strategies)
  - Tag-boosted scoring (exact tag match gives 2× weight)
  - Structured FAQ lookup by document ID

Swap for a vector store (Pinecone, pgvector, Chroma) in production by
replacing the `retrieve()` function body — the interface is identical.
"""
from __future__ import annotations
import re
import math
import logging
from dataclasses import dataclass, field
from .flights_kb import FLIGHTS_KB, STRUCTURED_DOCS, CATEGORY_META

logger = logging.getLogger(__name__)

TAG_BOOST = 2.0          # multiplier applied when a query token matches a tag
MIN_SCORE = 0.01         # documents scoring below this are excluded


# ─── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class RAGResult:
    doc_id: str
    title: str
    category: str
    snippet: str
    score: float
    examples: list[str] = field(default_factory=list)
    related: list[str] = field(default_factory=list)


# ─── Tokenisation ──────────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokens, preserving numbers (e.g. '5/24', '1:1')."""
    return re.findall(r"[a-z0-9]+(?:[:/][a-z0-9]+)?", text.lower())


# ─── BM25 scoring ─────────────────────────────────────────────────────────────

def _tf(term: str, tokens: list[str]) -> float:
    count = tokens.count(term)
    return count / len(tokens) if tokens else 0.0


def _idf(term: str, corpus: list[list[str]]) -> float:
    df = sum(1 for doc in corpus if term in doc)
    return math.log((len(corpus) + 1) / (df + 1)) + 1.0


def _tag_boost(term: str, doc: dict) -> float:
    """Return TAG_BOOST if `term` appears in the document's tag list."""
    tags = " ".join(doc.get("tags", []))
    return TAG_BOOST if term in _tokenize(tags) else 1.0


def _score_doc(
    query_tokens: list[str],
    doc_tokens: list[str],
    corpus: list[list[str]],
    doc: dict,
) -> float:
    score = 0.0
    for term in set(query_tokens):
        tf = _tf(term, doc_tokens)
        if tf == 0:
            continue
        idf = _idf(term, corpus)
        boost = _tag_boost(term, doc)
        score += tf * idf * boost
    return score


# ─── Snippet extraction ────────────────────────────────────────────────────────

def _extract_snippet(content: str, query_tokens: list[str], max_len: int = 220) -> str:
    """Return the sentence from `content` most relevant to the query."""
    sentences = re.split(r"(?<=[.!?])\s+", content)
    best_sent, best_hits = content[:max_len], 0
    for sent in sentences:
        hits = sum(1 for t in query_tokens if t in sent.lower())
        if hits > best_hits:
            best_hits, best_sent = hits, sent
    return best_sent[:max_len]


# ─── Public API ────────────────────────────────────────────────────────────────

async def retrieve(
    query: str,
    top_k: int = 3,
    category: str | None = None,
) -> list[RAGResult]:
    """
    Retrieve the top_k most relevant KB documents for `query`.

    Args:
        query:    Natural-language user query.
        top_k:    Number of results to return.
        category: Optional filter — one of 'points_vs_cash', 'airline_programs',
                  'credit_cards', 'booking_strategies'.

    Returns:
        List of RAGResult objects sorted by relevance score descending.
    """
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    # Apply category filter
    docs = [d for d in FLIGHTS_KB if category is None or d["category"] == category]
    if not docs:
        return []

    # Pre-tokenise corpus for IDF calculation
    corpus = [_tokenize(d["content"] + " " + " ".join(d.get("tags", []))) for d in docs]

    scored: list[tuple[dict, float]] = []
    for doc, doc_tokens in zip(docs, corpus):
        score = _score_doc(query_tokens, doc_tokens, corpus, doc)
        if score >= MIN_SCORE:
            scored.append((doc, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    results: list[RAGResult] = []
    for doc, score in scored[:top_k]:
        snippet = _extract_snippet(doc["content"], query_tokens)
        results.append(RAGResult(
            doc_id=doc["id"],
            title=doc["title"],
            category=doc["category"],
            snippet=snippet,
            score=round(score, 4),
            examples=doc.get("examples", []),
            related=doc.get("related", []),
        ))

    logger.debug(
        "RAG [flights] retrieved %d docs for query %r (category=%s)",
        len(results), query[:60], category or "all",
    )
    return results


def get_doc_by_id(doc_id: str) -> dict | None:
    """Look up a single KB document by its ID. Returns None if not found."""
    for doc in FLIGHTS_KB:
        if doc["id"] == doc_id:
            return doc
    return None


def get_faq_tree() -> dict:
    """
    Return the full structured FAQ/help-center tree.

    Schema:
      {
        category_key: {
          "label": str,
          "icon": str,
          "description": str,
          "docs": [{ id, title, summary, examples, related }]
        }
      }
    """
    return {
        cat: {**CATEGORY_META.get(cat, {"label": cat, "icon": "📄", "description": ""}),
              "docs": docs}
        for cat, docs in STRUCTURED_DOCS.items()
    }


def get_related_docs(doc_id: str, top_k: int = 3) -> list[dict]:
    """
    Return the related documents for a given doc ID.
    Returns up to top_k full document dicts.
    """
    doc = get_doc_by_id(doc_id)
    if not doc:
        return []
    related_ids = doc.get("related", [])[:top_k]
    return [d for d in FLIGHTS_KB if d["id"] in related_ids]
