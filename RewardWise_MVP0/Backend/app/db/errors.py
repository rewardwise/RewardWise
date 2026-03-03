#Db error handling

from typing import Any, Literal, Optional

DbErrorCode = Literal[
    "UNIQUE_VIOLATION",
    "FOREIGN_KEY_VIOLATION",
    "NOT_NULL_VIOLATION",
    "CHECK_VIOLATION",
    "PGRST116",
    "UNKNOWN",
]


class DbError(Exception):

    def __init__(
        self,
        message: str,
        code: DbErrorCode = "UNKNOWN",
        table: Optional[str] = None,
        details: Optional[str] = None,
        original: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.code = code
        self.table = table
        self.details = details
        self.original = original
        self.name = "DbError"


def _map_postgres_code(code: Optional[str]) -> DbErrorCode:
    if not code:
        return "UNKNOWN"
    mapping = {
        "23505": "UNIQUE_VIOLATION",
        "23503": "FOREIGN_KEY_VIOLATION",
        "23502": "NOT_NULL_VIOLATION",
        "23514": "CHECK_VIOLATION",
        "PGRST116": "PGRST116",
    }
    return mapping.get(code, "UNKNOWN")


def _get_friendly_message(code: DbErrorCode, table: Optional[str] = None) -> str:
    messages = {
        "UNIQUE_VIOLATION": f"Duplicate entry in {table}" if table else "Duplicate entry",
        "FOREIGN_KEY_VIOLATION": (
            f"Invalid reference in {table}" if table else "Invalid reference"
        ),
        "NOT_NULL_VIOLATION": (
            f"Missing required field in {table}" if table else "Missing required field"
        ),
        "CHECK_VIOLATION": (
            f"Invalid value in {table}" if table else "Invalid value"
        ),
        "PGRST116": "Record not found",
        "UNKNOWN": "Database error",
    }
    return messages[code]


def wrap_supabase_error(
    error: Optional[Exception],
    context: Optional[dict[str, Any]] = None,
) -> Optional[DbError]:
    if error is None:
        return None

    context = context or {}
    code_str = getattr(error, "code", None) or getattr(error, "details", "")
    if isinstance(code_str, dict):
        code_str = code_str.get("code", "")
    code = _map_postgres_code(str(code_str) if code_str else None)
    table = context.get("table")
    operation = context.get("operation")
    message = _get_friendly_message(code, table)
    if operation:
        message = f"{message} ({operation})"

    details = getattr(error, "details", None) or str(error)
    if isinstance(details, dict):
        details = details.get("message", str(error))

    return DbError(
        message=message,
        code=code,
        table=table,
        details=details,
        original=error,
    )


def assert_no_error(
    error: Optional[Exception],
    context: Optional[dict[str, Any]] = None,
) -> None:
    db_error = wrap_supabase_error(error, context)
    if db_error is not None:
        raise db_error
