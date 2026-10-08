"""add missing interview session constraints

Revision ID: c7f1e2a9d4b6
Revises: a9c4c63a79be
Create Date: 2026-09-05
"""

import sqlalchemy as sa

from alembic import op

revision = "c7f1e2a9d4b6"
down_revision = "ba859ad28cca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Get the list of existing check constraints on the interview_sessions table
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "interview_sessions" not in tables:
        return

    constraints = inspector.get_check_constraints("interview_sessions")
    existing_constraint_names = {c["name"] for c in constraints if c.get("name")}

    # List of constraints to create: (name, condition)
    constraints_to_create = [
        (
            "ck_interview_status",
            """status IN (
                'pending',
                'CREATED',
                'QUEUED',
                'VIDEO_PROCESSING',
                'AUDIO_PROCESSING',
                'EVALUATING',
                'PROCESSING',
                'COMPLETED',
                'FAILED',
                'TIMEOUT',
                'CANCELLED'
            )""",
        ),
        (
            "ck_risk_score_non_negative",
            "risk_score IS NULL OR risk_score >= 0",
        ),
        (
            "ck_overall_score_non_negative",
            "overall_score IS NULL OR overall_score >= 0",
        ),
    ]

    for name, condition in constraints_to_create:
        if name not in existing_constraint_names:
            op.create_check_constraint(name, "interview_sessions", condition)


def downgrade() -> None:
    # Get the list of existing check constraints on the interview_sessions table
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "interview_sessions" not in tables:
        return

    constraints = inspector.get_check_constraints("interview_sessions")
    existing_constraint_names = {c["name"] for c in constraints if c.get("name")}

    # List of constraints to drop
    constraints_to_drop = [
        "ck_overall_score_non_negative",
        "ck_risk_score_non_negative",
        "ck_interview_status",
    ]

    for name in constraints_to_drop:
        if name in existing_constraint_names:
            op.drop_constraint(name, "interview_sessions", type_="check")
