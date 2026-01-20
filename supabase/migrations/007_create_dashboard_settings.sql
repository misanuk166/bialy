-- =============================================
-- Bialy Database Schema
-- Migration 007: Create Dashboard Settings Table
-- =============================================

-- Create dashboard_settings table
CREATE TABLE IF NOT EXISTS public.dashboard_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  dashboard_id UUID REFERENCES public.dashboards ON DELETE CASCADE,  -- NULL for global settings
  setting_id TEXT NOT NULL,
  setting_value JSONB NOT NULL,  -- Flexible to store any type of value (string, number, boolean, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, dashboard_id, setting_id)  -- Prevent duplicate settings per user/dashboard/setting combination
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_settings_user ON public.dashboard_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_settings_dashboard ON public.dashboard_settings(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_settings_lookup ON public.dashboard_settings(user_id, dashboard_id, setting_id);

-- Add comments for documentation
COMMENT ON TABLE public.dashboard_settings IS 'User-specific dashboard settings with global defaults and per-dashboard overrides';
COMMENT ON COLUMN public.dashboard_settings.dashboard_id IS 'NULL for global settings, dashboard ID for dashboard-specific overrides';
COMMENT ON COLUMN public.dashboard_settings.setting_id IS 'Setting identifier (e.g., decimalPlaces, seriesColor, dateRange, etc.)';
COMMENT ON COLUMN public.dashboard_settings.setting_value IS 'JSONB value supporting strings, numbers, booleans, objects, etc.';
