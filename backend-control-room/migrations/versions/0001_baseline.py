"""baseline: schema esistente (users, drones, flight_plans, missions, no_fly_zones, telemetry_logs, system_logs)

Revision ID: 0001
Revises:
Create Date: 2026-07-23

NOTA IMPORTANTE:
Questa migrazione rispecchia lo schema che il database ha GIA' (creato in
precedenza con create_tables.py, più le colonne di approvazione aggiunte
manualmente con migrate_add_approval_columns.py). Se il tuo database ha
già queste tabelle, NON lanciare "alembic upgrade head" - fallirebbe perché
le tabelle esistono già. Va invece "timbrata" come già applicata:

    alembic stamp head

Da questo momento in poi, ogni nuova modifica allo schema si fa con:

    alembic revision --autogenerate -m "descrizione della modifica"
    alembic upgrade head

Solo per un database nuovo di zecca (mai inizializzato) puoi usare
"alembic upgrade head" direttamente al posto di create_tables.py.
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('badge_code', sa.String(), nullable=False),
        sa.Column('codice_fiscale', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
    )
    op.create_index('ix_users_badge_code', 'users', ['badge_code'], unique=True)
    op.create_index('ix_users_codice_fiscale', 'users', ['codice_fiscale'], unique=True)

    op.create_table(
        'drones',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('hardware_serial', sa.String(), nullable=False, unique=True),
        sa.Column('status', sa.String(), server_default='IDLE'),
        sa.Column('payload_sensors', sa.String(), nullable=True),
    )

    op.create_table(
        'flight_plans',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('route_name', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('route_geometry', Geometry(geometry_type='LINESTRING', srid=4326)),
        sa.Column('details', sa.String()),
    )

    op.create_table(
        'missions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('flight_plan_id', sa.Integer(), sa.ForeignKey('flight_plans.id')),
        sa.Column('drone_id', sa.Integer(), sa.ForeignKey('drones.id')),
        sa.Column('pilot_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('status', sa.String(), server_default='PLANNED'),
        sa.Column('start_timestamp', sa.DateTime()),
        sa.Column('pilot_approved', sa.Boolean(), server_default=sa.false()),
        sa.Column('manager_approved', sa.Boolean(), server_default=sa.false()),
        sa.Column('pilot_rejected', sa.Boolean(), server_default=sa.false()),
    )

    op.create_table(
        'no_fly_zones',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('geometry', Geometry(geometry_type='POLYGON', srid=4326)),
        sa.Column('active', sa.Boolean(), server_default=sa.true()),
        sa.Column('description', sa.String(), nullable=True),
    )

    op.create_table(
        'telemetry_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('mission_id', sa.Integer(), sa.ForeignKey('missions.id'), index=True),
        sa.Column('timestamp', sa.DateTime(), index=True),
        sa.Column('position', Geometry(geometry_type='POINTZ', srid=4326)),
        sa.Column('battery_percentage', sa.Float()),
        sa.Column('heading', sa.Float()),
        sa.Column('speed', sa.Float()),
        sa.Column('sensor_data', sa.JSON(), nullable=True),
    )

    op.create_table(
        'system_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('timestamp', sa.DateTime(), index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('system_logs')
    op.drop_table('telemetry_logs')
    op.drop_table('no_fly_zones')
    op.drop_table('missions')
    op.drop_table('flight_plans')
    op.drop_table('drones')
    op.drop_table('users')
