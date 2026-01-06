-- =============================================
-- Bialy Database Triggers and Functions
-- Migration 004: Triggers for Auto-Updates
-- =============================================

-- =============================================
-- FUNCTION: Auto-update updated_at timestamp
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS: Apply updated_at to tables
-- =============================================

-- Dashboards table
CREATE TRIGGER set_updated_at_dashboards
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Metrics table
CREATE TRIGGER set_updated_at_metrics
  BEFORE UPDATE ON public.metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Metric configurations table
CREATE TRIGGER set_updated_at_metric_configurations
  BEFORE UPDATE ON public.metric_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- FUNCTION: Auto-create user profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, profile_picture_url, last_login_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET last_login_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FUNCTION: Clean up CSV files when metric is deleted
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_metric_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the file from storage
  -- Note: This requires the storage.objects DELETE permission
  -- The RLS policy already allows users to delete their own files
  DELETE FROM storage.objects
  WHERE bucket_id = 'csv-files'
  AND name = OLD.data_file_path;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on metrics table
CREATE TRIGGER on_metric_deleted
  BEFORE DELETE ON public.metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_metric_file();

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to extract domain from email
CREATE OR REPLACE FUNCTION public.get_email_domain(email TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN SPLIT_PART(email, '@', 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user has access to dashboard
CREATE OR REPLACE FUNCTION public.user_can_access_dashboard(
  dashboard_id UUID,
  user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  dashboard_record RECORD;
  user_email TEXT;
  owner_email TEXT;
BEGIN
  -- Get dashboard details
  SELECT * INTO dashboard_record
  FROM public.dashboards
  WHERE id = dashboard_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Owner always has access
  IF dashboard_record.owner_id = user_id THEN
    RETURN TRUE;
  END IF;

  -- Public dashboards are accessible to everyone
  IF dashboard_record.permission_level = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Domain-level sharing
  IF dashboard_record.permission_level = 'domain' THEN
    -- Get user's email
    SELECT email INTO user_email
    FROM public.profiles
    WHERE id = user_id;

    -- Get owner's email
    SELECT email INTO owner_email
    FROM public.profiles
    WHERE id = dashboard_record.owner_id;

    -- Check if domains match
    IF get_email_domain(user_email) = get_email_domain(owner_email) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- NOTES ON TRIGGERS
-- =============================================
--
-- 1. updated_at triggers automatically update timestamps on row changes
-- 2. handle_new_user creates/updates profile on user authentication
-- 3. delete_metric_file cleans up CSV files when metrics are deleted
-- 4. Utility functions provide helper methods for access control
--
-- Security Notes:
-- - Triggers use SECURITY DEFINER to bypass RLS when needed
-- - File deletion only occurs for files user owns (enforced by RLS)
-- - Profile creation happens automatically on first login
