-- =============================================
-- Bialy Row Level Security Policies
-- Migration 002: Enable RLS and Create Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_configurations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES TABLE POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (for first-time login)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- DASHBOARDS TABLE POLICIES
-- =============================================

-- Users can view their own dashboards
CREATE POLICY "Users can view their own dashboards"
  ON public.dashboards
  FOR SELECT
  USING (owner_id = auth.uid());

-- Users can view domain-shared dashboards (same email domain)
CREATE POLICY "Users can view domain-shared dashboards"
  ON public.dashboards
  FOR SELECT
  USING (
    permission_level = 'domain' AND
    SPLIT_PART((SELECT email FROM public.profiles WHERE id = auth.uid()), '@', 2) =
    SPLIT_PART((SELECT email FROM public.profiles WHERE id = owner_id), '@', 2)
  );

-- Anyone can view public dashboards (even without authentication)
CREATE POLICY "Anyone can view public dashboards"
  ON public.dashboards
  FOR SELECT
  USING (permission_level = 'public');

-- Users can insert their own dashboards
CREATE POLICY "Users can insert their own dashboards"
  ON public.dashboards
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own dashboards
CREATE POLICY "Users can update their own dashboards"
  ON public.dashboards
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own dashboards
CREATE POLICY "Users can delete their own dashboards"
  ON public.dashboards
  FOR DELETE
  USING (owner_id = auth.uid());

-- =============================================
-- METRICS TABLE POLICIES
-- =============================================

-- Users can view metrics from accessible dashboards
-- (This inherits dashboard access permissions via the JOIN)
CREATE POLICY "Users can view metrics from accessible dashboards"
  ON public.metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      WHERE dashboards.id = metrics.dashboard_id
      AND (
        -- Owner can see their own
        dashboards.owner_id = auth.uid()
        OR
        -- Domain sharing
        (
          dashboards.permission_level = 'domain' AND
          SPLIT_PART((SELECT email FROM public.profiles WHERE id = auth.uid()), '@', 2) =
          SPLIT_PART((SELECT email FROM public.profiles WHERE id = dashboards.owner_id), '@', 2)
        )
        OR
        -- Public dashboards
        dashboards.permission_level = 'public'
      )
    )
  );

-- Users can manage metrics in their own dashboards
CREATE POLICY "Users can insert metrics in their own dashboards"
  ON public.metrics
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards
      WHERE dashboards.id = metrics.dashboard_id
      AND dashboards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update metrics in their own dashboards"
  ON public.metrics
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      WHERE dashboards.id = metrics.dashboard_id
      AND dashboards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards
      WHERE dashboards.id = metrics.dashboard_id
      AND dashboards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete metrics in their own dashboards"
  ON public.metrics
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards
      WHERE dashboards.id = metrics.dashboard_id
      AND dashboards.owner_id = auth.uid()
    )
  );

-- =============================================
-- METRIC_CONFIGURATIONS TABLE POLICIES
-- =============================================

-- Users can view configs from accessible metrics
CREATE POLICY "Users can view configs from accessible metrics"
  ON public.metric_configurations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.metrics m
      JOIN public.dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
      AND (
        -- Owner can see their own
        d.owner_id = auth.uid()
        OR
        -- Domain sharing
        (
          d.permission_level = 'domain' AND
          SPLIT_PART((SELECT email FROM public.profiles WHERE id = auth.uid()), '@', 2) =
          SPLIT_PART((SELECT email FROM public.profiles WHERE id = d.owner_id), '@', 2)
        )
        OR
        -- Public dashboards
        d.permission_level = 'public'
      )
    )
  );

-- Users can manage configs in their own dashboards
CREATE POLICY "Users can insert configs in their own dashboards"
  ON public.metric_configurations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.metrics m
      JOIN public.dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
      AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update configs in their own dashboards"
  ON public.metric_configurations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.metrics m
      JOIN public.dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
      AND d.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.metrics m
      JOIN public.dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
      AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete configs in their own dashboards"
  ON public.metric_configurations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.metrics m
      JOIN public.dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
      AND d.owner_id = auth.uid()
    )
  );

-- =============================================
-- NOTES ON RLS POLICIES
-- =============================================
--
-- Security Model:
-- 1. Private dashboards: Only owner can access
-- 2. Domain dashboards: Anyone with same email domain can VIEW
-- 3. Public dashboards: Anyone can VIEW (even unauthenticated)
-- 4. Only owners can EDIT/DELETE their dashboards and metrics
-- 5. Metrics and configs inherit access from dashboard permissions
--
-- Performance Considerations:
-- - Policies use EXISTS for better performance than subqueries
-- - Email domain comparison cached in profiles table
-- - Indexes on owner_id and permission_level optimize queries
