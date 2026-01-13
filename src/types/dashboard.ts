import type { MetricConfig, GlobalSettings } from './appState';

/**
 * Permission levels for dashboard sharing
 */
export type PermissionLevel = 'private' | 'domain' | 'public';

/**
 * Dashboard as stored in database
 */
export interface Dashboard {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  permission_level: PermissionLevel;
  created_at: string;
  updated_at: string;
  last_viewed_at: string;
}

/**
 * Dashboard with associated data for UI
 */
export interface DashboardWithData extends Dashboard {
  metrics: MetricConfig[];
  global_settings: GlobalSettings;
}

/**
 * Dashboard creation input
 */
export interface CreateDashboardInput {
  name: string;
  description?: string;
  permission_level?: PermissionLevel;
}

/**
 * Dashboard update input
 */
export interface UpdateDashboardInput {
  name?: string;
  description?: string;
  permission_level?: PermissionLevel;
}

/**
 * Dashboard with metrics count for list views
 */
export interface DashboardWithMetricsCount extends Dashboard {
  metrics_count: number;
}
