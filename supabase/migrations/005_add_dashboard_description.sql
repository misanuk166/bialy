-- =============================================
-- Bialy Database Schema
-- Migration 005: Add description column to dashboards
-- =============================================

-- Add description column to dashboards table
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.dashboards.description IS 'Optional long-form description of the dashboard';
