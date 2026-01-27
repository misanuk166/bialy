-- Add is_favorite column to dashboards table
-- This allows users to mark dashboards as favorites for quick access

ALTER TABLE dashboards
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster filtering of favorite dashboards
CREATE INDEX IF NOT EXISTS idx_dashboards_is_favorite
ON dashboards(owner_id, is_favorite)
WHERE is_favorite = TRUE;

-- Add comment
COMMENT ON COLUMN dashboards.is_favorite IS 'Whether this dashboard is marked as a favorite by the owner';
