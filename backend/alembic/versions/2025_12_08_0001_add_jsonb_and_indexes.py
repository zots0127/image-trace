"""add jsonb columns and indexes"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2025_12_08_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AnalysisResult JSONB columns (Postgres)
    op.add_column("analysis_results", sa.Column("parameters_json", sa.JSON(), nullable=True))
    op.add_column("analysis_results", sa.Column("results_json", sa.JSON(), nullable=True))

    # Indexes for analysis_results
    op.create_index("idx_analysis_project", "analysis_results", ["project_id"])
    op.create_index("idx_analysis_status", "analysis_results", ["status"])

    # Indexes for images/documents
    op.create_index("idx_images_project", "images", ["project_id"])
    op.create_index("idx_images_checksum", "images", ["checksum"])
    op.create_index("idx_documents_project", "documents", ["project_id"])
    op.create_index("idx_documents_checksum", "documents", ["checksum"])


def downgrade() -> None:
    op.drop_index("idx_documents_checksum", table_name="documents")
    op.drop_index("idx_documents_project", table_name="documents")
    op.drop_index("idx_images_checksum", table_name="images")
    op.drop_index("idx_images_project", table_name="images")
    op.drop_index("idx_analysis_status", table_name="analysis_results")
    op.drop_index("idx_analysis_project", table_name="analysis_results")
    op.drop_column("analysis_results", "results_json")
    op.drop_column("analysis_results", "parameters_json")

