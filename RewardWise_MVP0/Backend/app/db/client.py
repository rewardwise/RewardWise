"""Uses SERVICE_ROLE_KEY for full access bypasses RLS
"""

import os
from typing import Optional

from supabase import Client, create_client

_client: Optional[Client] = None


def get_db_client() -> Client:
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY)"
        )

    _client = create_client(url, key)
    return _client


def get_server_supabase() -> Client:
    return get_db_client()
