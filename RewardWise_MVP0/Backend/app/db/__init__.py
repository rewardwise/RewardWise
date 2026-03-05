"""
=============================================================================
DB MODULE - PUBLIC EXPORTS
=============================================================================
"""

from app.db.client import get_db_client, get_server_supabase
from app.db.crud import (
    delete_by_id,
    find_by_id,
    insert_one,
    insert_one_return_id,
    update_by_id,
)
from app.db.errors import (
    DbError,
    DbErrorCode,
    assert_no_error,
    wrap_supabase_error,
)
from app.db.queries import (
    find_by_foreign_key,
    find_many,
    find_one,
    ListOptions,
)

__all__ = [
    "get_db_client",
    "get_server_supabase",
    "DbError",
    "DbErrorCode",
    "wrap_supabase_error",
    "assert_no_error",
    "insert_one",
    "insert_one_return_id",
    "find_by_id",
    "update_by_id",
    "delete_by_id",
    "find_many",
    "find_one",
    "find_by_foreign_key",
    "ListOptions",
]
