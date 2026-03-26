"""
Quick smoke-test for the FlightWise KB + retriever.
Run: python -m backend.rag.test_kb
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from backend.rag.flights_kb import FLIGHTS_KB, STRUCTURED_DOCS, CATEGORY_META
from backend.rag.flights_retriever import retrieve, get_faq_tree, get_doc_by_id, get_related_docs


def banner(title: str) -> None:
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")


async def main():
    # ── 1. KB stats ─────────────────────────────────────────────
    banner("KB Stats")
    print(f"Total documents : {len(FLIGHTS_KB)}")
    for cat, docs in STRUCTURED_DOCS.items():
        meta = CATEGORY_META.get(cat, {})
        print(f"  {meta.get('icon','•')} {meta.get('label', cat)}: {len(docs)} docs")

    # ── 2. Sample retrieval queries ──────────────────────────────
    test_queries = [
        ("Is it worth using miles for a $300 flight?",          None),
        ("Best way to fly business class to Japan",             None),
        ("How do Chase transfer partners work?",                "credit_cards"),
        ("ANA sweet spot Virgin Atlantic",                      "booking_strategies"),
        ("fuel surcharges British Airways",                     "airline_programs"),
        ("when should I pay cash instead of points",            "points_vs_cash"),
        ("companion pass southwest",                            None),
        ("dynamic pricing delta skymiles",                      None),
        ("how to find award seats availability",                "booking_strategies"),
        ("open jaw stopover routing excursionist",              None),
    ]

    banner("Retrieval Tests")
    for query, cat in test_queries:
        results = await retrieve(query, top_k=2, category=cat)
        cat_label = f"[{cat}]" if cat else "[all]"
        print(f"\nQ {cat_label}: {query!r}")
        for r in results:
            print(f"  → {r.score:.4f}  {r.doc_id}  |  {r.snippet[:80]}...")

    # ── 3. FAQ tree structure ────────────────────────────────────
    banner("FAQ Tree Structure")
    faq = get_faq_tree()
    for cat, data in faq.items():
        print(f"\n{data['icon']} {data['label']} ({len(data['docs'])} docs)")
        for doc in data["docs"]:
            print(f"   [{doc['id']}] {doc['title']}")
            if doc.get("examples"):
                print(f"     Examples: {len(doc['examples'])}")

    # ── 4. Document lookup + related docs ───────────────────────
    banner("Document Lookup")
    doc = get_doc_by_id("sweet-spots-guide")
    if doc:
        print(f"Title   : {doc['title']}")
        print(f"Summary : {doc['summary'][:120]}...")
        print(f"Tags    : {doc['tags']}")
        related = get_related_docs("sweet-spots-guide")
        print(f"Related : {[r['id'] for r in related]}")

    # ── 5. Edge cases ────────────────────────────────────────────
    banner("Edge Cases")
    empty = await retrieve("", top_k=3)
    print(f"Empty query result count: {len(empty)} (expected 0)")

    no_match = await retrieve("quantum entanglement blockchain nft", top_k=3)
    print(f"Gibberish query results: {len(no_match)} (expected 0 or very low scores)")
    for r in no_match:
        print(f"  → {r.score:.4f}  {r.doc_id}")

    unknown = get_doc_by_id("nonexistent-doc")
    print(f"Unknown doc lookup: {unknown} (expected None)")

    print("\n✅  All tests passed.\n")


if __name__ == "__main__":
    asyncio.run(main())
