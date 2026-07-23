"""flight_plans: aggiunge waypoints_json (fonte di verità per i waypoint, non più il file su disco)

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-23

NOTA:
Prima di questa migrazione, GET /api/missions rileggeva e riparsava
uploaded_missions/<file>.json ad ogni richiesta. Se quel file veniva
spostato o cancellato, la rotta spariva silenziosamente dalla mappa 2D
(è successo). Ora i waypoint vengono estratti una sola volta al momento
dell'upload e salvati qui; il file su disco resta solo come backup.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('flight_plans', sa.Column('waypoints_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('flight_plans', 'waypoints_json')
