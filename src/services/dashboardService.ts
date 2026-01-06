import { supabase } from '../lib/supabase';
import { downloadCSVFile } from './storageService';
import type {
  Dashboard,
  DashboardWithData,
  CreateDashboardInput,
  UpdateDashboardInput
} from '../types/dashboard';
import type { MetricConfig, GlobalSettings } from '../types/appState';
import type { Series } from '../types/series';

/**
 * Fetch all dashboards accessible to the current user
 */
export async function fetchDashboards(): Promise<Dashboard[]> {
  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching dashboards:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch dashboards owned by the current user
 */
export async function fetchMyDashboards(): Promise<Dashboard[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching my dashboards:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch dashboards shared with the current user (not owned by them)
 * Note: RLS policies handle filtering by permission level (public or domain-shared)
 */
export async function fetchSharedDashboards(): Promise<Dashboard[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .neq('owner_id', user.id) // Not owned by current user
    .in('permission_level', ['domain', 'public']) // Only shared dashboards
    .order('updated_at', { ascending: false});

  if (error) {
    console.error('Error fetching shared dashboards:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a specific dashboard with all its data (metrics and settings)
 */
export async function fetchDashboard(dashboardId: string): Promise<DashboardWithData | null> {
  // Fetch dashboard metadata
  const { data: dashboard, error: dashboardError } = await supabase
    .from('dashboards')
    .select('*')
    .eq('id', dashboardId)
    .single();

  if (dashboardError) {
    console.error('Error fetching dashboard:', dashboardError);
    throw dashboardError;
  }

  if (!dashboard) {
    return null;
  }

  // Fetch metrics for this dashboard
  const { data: metrics, error: metricsError } = await supabase
    .from('metrics')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .order('order_index', { ascending: true });

  if (metricsError) {
    console.error('Error fetching metrics:', metricsError);
    throw metricsError;
  }

  // Fetch metric configurations
  const metricIds = metrics?.map(m => m.id) || [];
  const { data: configs, error: configsError } = await supabase
    .from('metric_configurations')
    .select('*')
    .in('metric_id', metricIds);

  if (configsError) {
    console.error('Error fetching metric configurations:', configsError);
    throw configsError;
  }

  // Transform database records to MetricConfig objects
  const metricConfigs: MetricConfig[] = await Promise.all(
    (metrics || []).map(async (metric) => {
      const metricConfigRecords = configs?.filter(c => c.metric_id === metric.id) || [];

      // Load series data from CSV file in storage
      let series: Series;
      if (metric.data_file_path) {
        try {
          series = await downloadCSVFile(metric.data_file_path);
          series.filePath = metric.data_file_path; // Store path for reference
        } catch (error) {
          console.error('Failed to load series from storage:', error);
          series = createPlaceholderSeries(metric.name, metric.unit);
        }
      } else {
        // Fallback for metrics without file paths (backward compatibility)
        series = createPlaceholderSeries(metric.name, metric.unit);
      }

      // Extract configurations by type
      const goals = metricConfigRecords.find(c => c.config_type === 'goals')?.config_data as any[] | undefined;
      const forecast = metricConfigRecords.find(c => c.config_type === 'forecast')?.config_data;
      const forecastSnapshot = metricConfigRecords.find(c => c.config_type === 'forecast_snapshot')?.config_data;
      const annotations = metricConfigRecords.find(c => c.config_type === 'annotations')?.config_data as any[] | undefined;

      return {
        id: metric.id,
        series,
        order: metric.order_index,
        goals: goals || [],
        goalsEnabled: false,
        forecast: forecast || { enabled: false, horizon: 90, seasonal: 'none', showConfidenceIntervals: true, confidenceLevel: 95 },
        forecastSnapshot,
        annotations: annotations || [],
        annotationsEnabled: false,
        metricIndex: metric.order_index
      };
    })
  );

  // Extract global settings from the first metric's config, or use defaults
  const globalSettingsRecord = configs?.find(c => c.config_type === 'global_settings');
  const globalSettings: GlobalSettings = globalSettingsRecord?.config_data as GlobalSettings || {
    aggregation: {
      enabled: true,
      mode: 'groupBy',
      period: 7,
      unit: 'days',
      groupByPeriod: 'week'
    },
    shadows: [],
    averageShadows: false,
    focusPeriod: { enabled: false },
    dateRange: { preset: 'all' },
    comparisons: [],
    selectionIncludesForecast: false,
    focusIncludesForecast: false,
    annotations: [],
    annotationsEnabled: false
  };

  return {
    ...dashboard,
    metrics: metricConfigs,
    global_settings: globalSettings
  };
}

/**
 * Create a new dashboard
 */
export async function createDashboard(input: CreateDashboardInput): Promise<Dashboard> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('dashboards')
    .insert({
      owner_id: user.id,
      name: input.name,
      permission_level: input.permission_level || 'private'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating dashboard:', error);
    throw error;
  }

  return data;
}

/**
 * Update dashboard metadata
 */
export async function updateDashboard(
  dashboardId: string,
  input: UpdateDashboardInput
): Promise<Dashboard> {
  const { data, error } = await supabase
    .from('dashboards')
    .update(input)
    .eq('id', dashboardId)
    .select()
    .single();

  if (error) {
    console.error('Error updating dashboard:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a dashboard
 */
export async function deleteDashboard(dashboardId: string): Promise<void> {
  const { error } = await supabase
    .from('dashboards')
    .delete()
    .eq('id', dashboardId);

  if (error) {
    console.error('Error deleting dashboard:', error);
    throw error;
  }
}

/**
 * Save dashboard data (metrics and global settings) to database
 */
export async function saveDashboardData(
  dashboardId: string,
  metrics: MetricConfig[],
  globalSettings: GlobalSettings
): Promise<void> {
  try {
    // First, delete all existing metrics for this dashboard
    const { error: deleteError } = await supabase
      .from('metrics')
      .delete()
      .eq('dashboard_id', dashboardId);

    if (deleteError) {
      console.error('Error deleting old metrics:', deleteError);
      throw deleteError;
    }

    // Insert new metrics
    if (metrics.length > 0) {
      const metricRecords = metrics.map((metric, index) => ({
        dashboard_id: dashboardId,
        name: metric.series.metadata.name,
        unit: metric.series.metadata.numeratorLabel || '',
        data_file_path: metric.series.filePath || '', // Store file path from storage
        order_index: index
      }));

      const { data: insertedMetrics, error: insertError } = await supabase
        .from('metrics')
        .insert(metricRecords)
        .select();

      if (insertError) {
        console.error('Error inserting metrics:', insertError);
        throw insertError;
      }

      // Insert metric configurations
      if (insertedMetrics) {
        const configRecords: any[] = [];

        insertedMetrics.forEach((dbMetric, index) => {
          const metric = metrics[index];

          // Add goals configuration
          if (metric.goals && metric.goals.length > 0) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'goals',
              config_data: metric.goals
            });
          }

          // Add forecast configuration
          if (metric.forecast) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'forecast',
              config_data: metric.forecast
            });
          }

          // Add forecast snapshot
          if (metric.forecastSnapshot) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'forecast_snapshot',
              config_data: metric.forecastSnapshot
            });
          }

          // Add annotations
          if (metric.annotations && metric.annotations.length > 0) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'annotations',
              config_data: metric.annotations
            });
          }
        });

        // Add global settings (stored with first metric for now)
        if (insertedMetrics.length > 0) {
          configRecords.push({
            metric_id: insertedMetrics[0].id,
            config_type: 'global_settings',
            config_data: globalSettings
          });
        }

        if (configRecords.length > 0) {
          const { error: configError } = await supabase
            .from('metric_configurations')
            .insert(configRecords);

          if (configError) {
            console.error('Error inserting metric configurations:', configError);
            throw configError;
          }
        }
      }
    }

    // Update dashboard's updated_at timestamp
    const { error: updateError } = await supabase
      .from('dashboards')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', dashboardId);

    if (updateError) {
      console.error('Error updating dashboard timestamp:', updateError);
      throw updateError;
    }
  } catch (error) {
    console.error('Error saving dashboard data:', error);
    throw error;
  }
}

/**
 * Create a placeholder series when file cannot be loaded
 */
function createPlaceholderSeries(name: string, unit: string): Series {
  return {
    id: crypto.randomUUID(),
    data: [],
    metadata: {
      name: name || 'Placeholder Metric',
      description: 'No data available',
      uploadDate: new Date(),
      numeratorLabel: unit || 'value',
      denominatorLabel: '1'
    }
  };
}
