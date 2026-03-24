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

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL is missing in backend env")

    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is missing in backend env")

    _client = create_client(url, key)
    return _client


def get_server_supabase() -> Client:
    return get_db_client()
