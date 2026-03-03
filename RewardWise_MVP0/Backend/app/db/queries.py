"""Query helpers"""
from typing import Any, Literal, Optional

from supabase import Client

from app.db.errors import DbError, wrap_supabase_error


class ListOptions:
    def __init__(
        self,
        *,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        order_by: Optional[str] = None,
        order: Literal["asc", "desc"] = "desc",
    ):
        self.limit = limit
        self.offset = offset
        self.order_by = order_by
        self.order = order


def find_many(
    db: Client,
    table: str,
    filters: Optional[dict[str, Any]] = None,
    *,
    select: str = "*",
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    order_by: Optional[str] = None,
    order: Literal["asc", "desc"] = "desc",
) -> list[dict[str, Any]]:
    """Find many rows with optional filters and ordering."""
    try:
        query = db.table(table).select(select)

        if filters:
            for key, value in filters.items():
                if value is not None:
                    query = query.eq(key, value)

        if order_by is not None:
            query = query.order(order_by, desc=(order == "desc"))

        if limit is not None:
            if offset is not None:
                query = query.range(offset, offset + limit - 1)
            else:
                query = query.limit(limit)

        response = query.execute()
        return list(response.data or [])
    except Exception as e:
        if isinstance(e, DbError):
            raise
        err = wrap_supabase_error(e, {"table": table, "operation": "select"})
        if err:
            raise err
        raise


def find_one(
    db: Client,
    table: str,
    filters: dict[str, Any],
    *,
    select: str = "*",
) -> Optional[dict[str, Any]]:
    try:
        query = db.table(table).select(select)
        for key, value in filters.items():
            if value is not None:
                query = query.eq(key, value)
        response = query.limit(1).execute()
        data = response.data
        if not data:
            return None
        return data[0]
    except Exception as e:
        if isinstance(e, DbError):
            raise
        err = wrap_supabase_error(e, {"table": table, "operation": "select"})
        if err:
            raise err
        raise


def find_by_foreign_key(
    db: Client,
    table: str,
    column: str,
    value: str,
    *,
    select: str = "*",
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    order_by: Optional[str] = "created_at",
    order: Literal["asc", "desc"] = "desc",
) -> list[dict[str, Any]]:
    return find_many(
        db,
        table,
        {column: value},
        select=select,
        limit=limit,
        offset=offset,
        order_by=order_by or "created_at",
        order=order,
    )
