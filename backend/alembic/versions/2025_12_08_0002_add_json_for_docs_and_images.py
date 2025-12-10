"""add json columns for documents/images and indexes"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2025_12_08_0002"
down_revision = "2025_12_08_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Document JSON metadata
    op.add_column("documents", sa.Column("document_metadata_json", sa.JSON(), nullable=True))

    # Image JSON metadata
    op.add_column("images", sa.Column("image_metadata_json", sa.JSON(), nullable=True))

    # ExtractedImage JSON metadata
    op.add_column("extracted_images", sa.Column("extraction_metadata_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("extracted_images", "extraction_metadata_json")
    op.drop_column("images", "image_metadata_json")
    op.drop_column("documents", "document_metadata_json")

