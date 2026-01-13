-- =============================================
-- Bialy Database Schema
-- Migration 006: Add last_viewed_at to track dashboard views
-- =============================================

-- Add last_viewed_at column to dashboards table
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for sorting by last viewed
CREATE INDEX IF NOT EXISTS idx_dashboards_last_viewed ON public.dashboards(last_viewed_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.dashboards.last_viewed_at IS 'Timestamp of when the dashboard was last opened/viewed';
