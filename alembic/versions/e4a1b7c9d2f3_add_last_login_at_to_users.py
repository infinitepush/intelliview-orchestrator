"""add last_login_at to users

Revision ID: e4a1b7c9d2f3
Revises: c7f1e2a9d4b6
Create Date: 2026-09-22

The User model defines ``users.last_login_at`` and ``routers/auth.py`` updates
it on login, but no migration ever added the column. Databases whose ``users``
table was created before the column existed fail during startup admin seeding
with ``psycopg2.errors.UndefinedColumn``.

The migration is defensive so it is safe in every environment:
* if the ``users`` table does not exist yet (fresh database, ``alembic upgrade
  head`` in CI) it does nothing, because ``Base.metadata.create_all`` creates
  the table with the column already included;
* if the column already exists it does nothing (idempotent).

``downgrade()`` only removes the column when this revision is the one that
created it. A database can reach this revision with ``last_login_at`` already
present (added by hand, restored from a backup, or created outside Alembic
entirely), and ``upgrade()`` deliberately treats that as a no-op rather than
an error. Without ownership tracking, ``downgrade()`` could not tell that case
apart from "this revision added it", and would delete a pre-existing column
and its data. To make that distinction durable across separate process runs
(not just within a single downgrade call), ``upgrade()`` stamps the column
with a comment identifying this revision only when it is the one performing
the ``ADD COLUMN``, and ``downgrade()`` checks for that exact comment before
dropping.
"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

logger = logging.getLogger("alembic.runtime.migration")

# revision identifiers, used by Alembic.
revision: str = "e4a1b7c9d2f3"
down_revision: str | Sequence[str] | None = "c7f1e2a9d4b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Marker written to the column comment only when this revision is the one
# that runs the ADD COLUMN, so downgrade() can later confirm ownership.
_OWNERSHIP_COMMENT = f"added_by_alembic_revision:{revision}"


def _users_table_exists() -> bool:
    """Return whether the ``users`` table exists yet."""
    return "users" in sa.inspect(op.get_bind()).get_table_names()


def _users_column(name: str) -> dict | None:
    """Return the reflected column dict for ``users.<name>``, or None.

    Also returns None if the ``users`` table itself does not exist yet;
    callers that must tell "table missing" apart from "column missing"
    (``upgrade()``) check ``_users_table_exists()`` explicitly first.
    """
    if not _users_table_exists():
        return None
    for col in sa.inspect(op.get_bind()).get_columns("users"):
        if col["name"] == name:
            return col
    return None


def upgrade() -> None:
    """Add the nullable users.last_login_at column.

    No-ops (leaving any existing column untouched) if the ``users`` table
    does not exist yet or the column is already present. The table-existence
    check must happen before the column check: ``_users_column`` returns
    None for "table missing" and "column missing" alike, and treating those
    as the same case here would call ``op.add_column`` on a table that does
    not exist yet and raise ``UndefinedTable``.
    """
    if not _users_table_exists():
        return
    if _users_column("last_login_at") is not None:
        return
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment=_OWNERSHIP_COMMENT,
        ),
    )


def downgrade() -> None:
    """Remove users.last_login_at, but only if this revision created it.

    Skips the drop, with a warning, when the column is missing, or when it
    is present without this revision's ownership comment: that means a
    pre-existing column (added by hand, restored from a backup, or created
    outside Alembic) that ``upgrade()`` found already there and left alone.
    """
    column = _users_column("last_login_at")
    if column is None:
        return
    if column.get("comment") != _OWNERSHIP_COMMENT:
        logger.warning(
            "Skipping drop of users.last_login_at: this revision (%s) did "
            "not create the column, so it is not this migration's to "
            "remove. Drop it manually if you are certain that is correct.",
            revision,
        )
        return
    op.drop_column("users", "last_login_at")
