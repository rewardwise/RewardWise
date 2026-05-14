"""
scripts/add_kb_article.py
──────────────────────────
Interactive CLI to add a single new KB article.
For one-off additions outside the flights_kb.py seed.

For bulk additions, add to flights_kb.py and re-run seed_kb.py.

Run from Backend/ directory:
    python scripts/add_kb_article.py

Or pass args directly:
    python scripts/add_kb_article.py \
        --title "Lufthansa First Class Sweet Spots" \
        --category airline_programs \
        --tags "lufthansa,first class,sweet spot,united miles" \
        --file article_content.txt \
        --publish
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()


VALID_CATEGORIES = [
    "airline_programs",
    "credit_cards",
    "booking_strategies",
    "destinations",
    "transfers",
]


async def add_article(
    title: str,
    category: str,
    content: str,
    tags: list[str],
    publish: bool,
):
    from app.services.zoe.rag.kb_manager import create_article

    print(f"\n  Adding: {title}")
    print(f"  Category: {category}")
    print(f"  Tags: {tags}")
    print(f"  Publish: {publish}")
    print(f"  Content length: {len(content)} chars\n")

    article = await create_article(
        title=title,
        category=category,
        content=content,
        tags=tags,
        publish=publish,
    )

    print(f"\n  ✅ Article created: {article.get('id')}")
    if publish:
        print("  Article is live and will be retrieved immediately.")
    else:
        print("  Article is a DRAFT. Publish via the admin API or re-run with --publish.")


def main():
    parser = argparse.ArgumentParser(description="Add a KB article to Zoe's knowledge base")
    parser.add_argument("--title", help="Article title")
    parser.add_argument("--category", choices=VALID_CATEGORIES, help="Article category")
    parser.add_argument("--tags", help="Comma-separated tags")
    parser.add_argument("--content", help="Article content as a string")
    parser.add_argument("--file", help="Path to a .txt file containing article content")
    parser.add_argument("--publish", action="store_true", help="Publish immediately (default: draft)")
    args = parser.parse_args()

    # Interactive mode if args missing
    title = args.title or input("Title: ").strip()
    if not title:
        print("Title is required.")
        sys.exit(1)

    if args.category:
        category = args.category
    else:
        print(f"Categories: {', '.join(VALID_CATEGORIES)}")
        category = input("Category: ").strip()
        if category not in VALID_CATEGORIES:
            print(f"Invalid category. Choose from: {VALID_CATEGORIES}")
            sys.exit(1)

    tags_raw = args.tags or input("Tags (comma-separated, optional): ").strip()
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

    if args.file:
        content = Path(args.file).read_text(encoding="utf-8").strip()
    elif args.content:
        content = args.content.strip()
    else:
        print("Paste article content (end with a line containing only '---'):")
        lines = []
        while True:
            line = input()
            if line.strip() == "---":
                break
            lines.append(line)
        content = "\n".join(lines).strip()

    if not content:
        print("Content is required.")
        sys.exit(1)

    publish = args.publish or (input("Publish now? (y/N): ").strip().lower() == "y")

    asyncio.run(add_article(title, category, content, tags, publish))


if __name__ == "__main__":
    main()
