-- =============================================
-- Bialy Row Level Security Policies
-- Migration 008: Dashboard Settings RLS Policies
-- =============================================

-- Enable RLS on dashboard_settings table
ALTER TABLE public.dashboard_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings (both global and dashboard-specific)
CREATE POLICY "Users can view their own settings"
  ON public.dashboard_settings
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own settings
CREATE POLICY "Users can insert their own settings"
  ON public.dashboard_settings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own settings
CREATE POLICY "Users can update their own settings"
  ON public.dashboard_settings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own settings
CREATE POLICY "Users can delete their own settings"
  ON public.dashboard_settings
  FOR DELETE
  USING (user_id = auth.uid());
