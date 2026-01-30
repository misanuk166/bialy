-- =============================================
-- Bialy Database Schema
-- Migration 010: Forecast and Anomaly Detection Settings
-- =============================================

-- This migration extends the dashboard_settings table to support:
-- 1. Per-metric forecast configurations
-- 2. Per-metric anomaly detection settings
-- 3. Cached forecast results (snapshots)

-- No schema changes needed - dashboard_settings table already supports JSONB storage
-- This migration documents the setting_id conventions and provides sample data

-- =============================================
-- Setting ID Conventions
-- =============================================

-- Per-Metric Forecast Settings:
--   setting_id: 'metric_{metric_id}_forecast_config'
--   setting_value: {
--     "enabled": true,
--     "type": "auto",
--     "horizon": 30,
--     "model": "auto",
--     "seasonLength": 7,
--     "confidenceLevels": [95, 99],
--     "showConfidenceIntervals": true
--   }

-- Per-Metric Forecast Snapshots (Cached Results):
--   setting_id: 'metric_{metric_id}_forecast_snapshot'
--   setting_value: {
--     "generatedAt": "2024-01-30T12:00:00Z",
--     "forecast": [...],
--     "confidenceIntervals": {...},
--     "modelUsed": "AutoETS",
--     "metrics": {...}
--   }

-- Per-Metric Anomaly Detection Settings:
--   setting_id: 'metric_{metric_id}_anomaly_config'
--   setting_value: {
--     "enabled": true,
--     "sensitivity": "medium",
--     "showConfidenceBands": true,
--     "lastDetectionAt": "2024-01-30T12:00:00Z"
--   }

-- Per-Metric Anomaly Results (Cached):
--   setting_id: 'metric_{metric_id}_anomaly_results'
--   setting_value: {
--     "detectedAt": "2024-01-30T12:00:00Z",
--     "anomalies": [...],
--     "totalPoints": 365,
--     "anomalyCount": 12,
--     "anomalyRate": 0.033
--   }

-- Global Anomaly Detection Settings:
--   setting_id: 'global_anomaly_sensitivity'
--   setting_value: {
--     "defaultSensitivity": "medium",
--     "enabledByDefault": false
--   }

-- =============================================
-- Helper Comments
-- =============================================

COMMENT ON TABLE public.dashboard_settings IS
'User-specific dashboard settings with support for:
- Global settings (dashboard_id = NULL)
- Per-dashboard settings (dashboard_id specified)
- Per-metric forecast configs (setting_id = metric_{id}_forecast_config)
- Per-metric anomaly configs (setting_id = metric_{id}_anomaly_config)
- Cached forecast/anomaly results for performance';

-- =============================================
-- Sample Data (Optional - for development)
-- =============================================

-- Example: Global anomaly sensitivity default
-- INSERT INTO public.dashboard_settings (user_id, dashboard_id, setting_id, setting_value)
-- VALUES (
--   'user-uuid-here',
--   NULL,  -- Global setting
--   'global_anomaly_sensitivity',
--   '{"defaultSensitivity": "medium", "enabledByDefault": false}'::jsonb
-- )
-- ON CONFLICT (user_id, dashboard_id, setting_id) DO NOTHING;

-- Example: Per-metric forecast config
-- INSERT INTO public.dashboard_settings (user_id, dashboard_id, setting_id, setting_value)
-- VALUES (
--   'user-uuid-here',
--   'dashboard-uuid-here',
--   'metric_abc123_forecast_config',
--   '{"enabled": true, "horizon": 30, "model": "auto", "confidenceLevels": [95, 99]}'::jsonb
-- )
-- ON CONFLICT (user_id, dashboard_id, setting_id) DO NOTHING;

-- =============================================
-- Indexes (Already exist from migration 007)
-- =============================================

-- These indexes support fast lookups:
-- - idx_dashboard_settings_user
-- - idx_dashboard_settings_dashboard
-- - idx_dashboard_settings_lookup

-- =============================================
-- Notes
-- =============================================

-- 1. Forecast snapshots should be invalidated when:
--    - Source data changes
--    - Forecast config changes
--    - Snapshot is older than 24 hours (configurable)

-- 2. Anomaly results should be regenerated when:
--    - New data is added
--    - Sensitivity changes
--    - Results are older than 1 hour (configurable)

-- 3. Consider adding a cleanup job to remove old snapshots:
--    - Snapshots older than 7 days can be safely deleted
--    - This prevents table bloat

-- 4. Future optimization: Move large snapshots to separate table
--    if JSONB size becomes an issue (unlikely for typical use)
