"""CRUD helpers"""

from typing import Any, Optional

from supabase import Client

from app.db.errors import DbError, wrap_supabase_error


def insert_one(
    db: Client,
    table: str,
    payload: dict[str, Any],
    *,
    select: str = "*",
) -> dict[str, Any]:
    try:
        response = db.table(table).insert(payload).execute()
        data = response.data
        if not data or len(data) == 0:
            raise DbError("Insert returned no data", "UNKNOWN", table)
        return data[0]
    except Exception as e:
        if isinstance(e, DbError):
            raise
        err = wrap_supabase_error(e, {"table": table, "operation": "insert"})
        if err:
            raise err
        raise


def insert_one_return_id(db: Client, table: str, payload: dict[str, Any]) -> str:
    row = insert_one(db, table, payload)
    return str(row["id"])


def find_by_id(
    db: Client,
    table: str,
    id: str,
    *,
    select: str = "*",
) -> Optional[dict[str, Any]]:
    try:
        response = (
            db.table(table)
            .select(select)
            .eq("id", id)
            .limit(1)
            .execute()
        )
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


def update_by_id(
    db: Client,
    table: str,
    id: str,
    payload: dict[str, Any],
    *,
    select: str = "*",
) -> dict[str, Any]:
    try:
        response = (
            db.table(table)
            .update(payload)
            .eq("id", id)
            .execute()
        )
        data = response.data
        if not data or len(data) == 0:
            raise DbError("Record not found", "PGRST116", table)
        return data[0]
    except Exception as e:
        if isinstance(e, DbError):
            raise
        err = wrap_supabase_error(e, {"table": table, "operation": "update"})
        if err:
            raise err
        raise


def delete_by_id(db: Client, table: str, id: str) -> bool:
    try:
        db.table(table).delete().eq("id", id).execute()
        return True
    except Exception as e:
        if isinstance(e, DbError):
            raise
        err = wrap_supabase_error(e, {"table": table, "operation": "delete"})
        if err:
            raise err
        raise
