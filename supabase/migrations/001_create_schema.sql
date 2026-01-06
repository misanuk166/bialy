-- =============================================
-- Bialy Database Schema
-- Migration 001: Create Tables and Indexes
-- =============================================

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dashboards table
CREATE TABLE IF NOT EXISTS public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  permission_level TEXT CHECK (permission_level IN ('private', 'domain', 'public')) DEFAULT 'private',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metrics table
CREATE TABLE IF NOT EXISTS public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES public.dashboards ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  data_file_path TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metric_configurations table
CREATE TABLE IF NOT EXISTS public.metric_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID REFERENCES public.metrics ON DELETE CASCADE NOT NULL,
  config_type TEXT CHECK (config_type IN ('aggregation', 'shadow', 'forecast', 'goal', 'annotation', 'focus_period')) NOT NULL,
  config_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON public.dashboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_permission ON public.dashboards(permission_level);
CREATE INDEX IF NOT EXISTS idx_metrics_dashboard ON public.metrics(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_metrics_order ON public.metrics(dashboard_id, order_index);
CREATE INDEX IF NOT EXISTS idx_metric_configs_metric ON public.metric_configurations(metric_id);
CREATE INDEX IF NOT EXISTS idx_metric_configs_type ON public.metric_configurations(metric_id, config_type);

-- Add comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.dashboards IS 'User dashboards with permission levels for sharing';
COMMENT ON TABLE public.metrics IS 'Metrics within dashboards, each with CSV data';
COMMENT ON TABLE public.metric_configurations IS 'Configuration data for metrics (aggregation, shadows, goals, etc.)';

COMMENT ON COLUMN public.dashboards.permission_level IS 'Access control: private (owner only), domain (same email domain), public (anyone with link)';
COMMENT ON COLUMN public.metrics.data_file_path IS 'Path to CSV file in Supabase Storage (format: user_id/dashboard_id/metric_id.csv)';
COMMENT ON COLUMN public.metrics.order_index IS 'Display order of metrics within dashboard';
COMMENT ON COLUMN public.metric_configurations.config_type IS 'Type of configuration: aggregation, shadow, forecast, goal, annotation, focus_period';
COMMENT ON COLUMN public.metric_configurations.config_data IS 'JSON configuration data specific to config_type';
