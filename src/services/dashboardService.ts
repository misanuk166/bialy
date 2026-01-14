import { supabase } from '../lib/supabase';
import { downloadCSVFile } from './storageService';
import type {
  Dashboard,
  DashboardWithData,
  DashboardWithMetricsCount,
  CreateDashboardInput,
  UpdateDashboardInput
} from '../types/dashboard';
import type { MetricConfig, GlobalSettings } from '../types/appState';
import type { Series } from '../types/series';
import { DEFAULT_SELECTION_COMPARISONS, DEFAULT_FOCUS_COMPARISONS } from '../types/comparison';

/**
 * Fetch all dashboards accessible to the current user
 * Ordered by last viewed (most recent first)
 */
export async function fetchDashboards(): Promise<Dashboard[]> {
  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .order('last_viewed_at', { ascending: false });

  if (error) {
    console.error('Error fetching dashboards:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all dashboards with metrics count
 * Ordered by last viewed (most recent first)
 */
export async function fetchDashboardsWithMetricsCount(): Promise<DashboardWithMetricsCount[]> {
  // Fetch all dashboards
  const { data: dashboards, error: dashboardsError } = await supabase
    .from('dashboards')
    .select('*')
    .order('last_viewed_at', { ascending: false });

  if (dashboardsError) {
    console.error('Error fetching dashboards:', dashboardsError);
    throw dashboardsError;
  }

  if (!dashboards || dashboards.length === 0) {
    return [];
  }

  // Fetch metrics counts for all dashboards in a single query
  const dashboardIds = dashboards.map(d => d.id);
  const { data: metricCounts, error: countsError } = await supabase
    .from('metrics')
    .select('dashboard_id')
    .in('dashboard_id', dashboardIds);

  if (countsError) {
    console.error('Error fetching metrics counts:', countsError);
    throw countsError;
  }

  // Count metrics per dashboard
  const countsMap = new Map<string, number>();
  (metricCounts || []).forEach(metric => {
    const currentCount = countsMap.get(metric.dashboard_id) || 0;
    countsMap.set(metric.dashboard_id, currentCount + 1);
  });

  // Combine dashboards with counts
  return dashboards.map(dashboard => ({
    ...dashboard,
    metrics_count: countsMap.get(dashboard.id) || 0
  }));
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
          console.log(`[LOAD] Loading metric "${metric.name}" from ${metric.data_file_path}`);

          // 🆕 PRE-FLIGHT CHECK - Verify file exists before downloading
          const userId = metric.data_file_path.split('/')[0];
          const fileName = metric.data_file_path.split('/').pop();

          const { data: listData, error: listError } = await supabase.storage
            .from('csv-files')
            .list(userId, {
              search: fileName
            });

          if (listError || !listData?.length) {
            console.error(`[LOAD] ✗ File does not exist: ${metric.data_file_path}`);
            console.error('      This metric was saved but the CSV file is missing.');
            console.error('      User will need to re-upload this data.');
            throw new Error('CSV file not found in storage');
          }

          console.log(`[LOAD] ✓ File exists, downloading...`);

          // Download and parse CSV
          series = await downloadCSVFile(metric.data_file_path);
          series.filePath = metric.data_file_path;

          console.log(`[LOAD] ✓ Loaded "${metric.name}" - ${series.data.length} data points`);
        } catch (error) {
          console.error(`[LOAD] ✗ Failed to load "${metric.name}":`, error);
          console.error(`       File path: ${metric.data_file_path}`);

          // Create placeholder with clear error message
          series = createPlaceholderSeries(metric.name, metric.unit);
          series.metadata.description = '⚠️ Data file missing - please re-upload';
        }
      } else {
        // Fallback for metrics without file paths (backward compatibility)
        console.warn(`[LOAD] Metric "${metric.name}" has no data_file_path, using placeholder`);
        series = createPlaceholderSeries(metric.name, metric.unit);
      }

      // Extract configurations by type
      const goalsRaw = metricConfigRecords.find(c => c.config_type === 'goal')?.config_data as any[] | undefined;
      const forecastConfigRaw = metricConfigRecords.find(c => c.config_type === 'forecast')?.config_data as any;
      const annotationsRaw = metricConfigRecords.find(c => c.config_type === 'annotation')?.config_data as any[] | undefined;

      // Deserialize forecast dates
      const forecast = forecastConfigRaw ? {
        ...forecastConfigRaw,
        startDate: forecastConfigRaw.startDate ? new Date(forecastConfigRaw.startDate) : undefined,
        snapshot: undefined
      } : undefined;

      // Deserialize forecast snapshot dates
      const forecastSnapshotRaw = forecastConfigRaw?.snapshot;
      const forecastSnapshot = forecastSnapshotRaw ? {
        ...forecastSnapshotRaw,
        config: {
          ...forecastSnapshotRaw.config,
          startDate: forecastSnapshotRaw.config.startDate ? new Date(forecastSnapshotRaw.config.startDate) : undefined
        }
      } : undefined;

      // Deserialize goal dates
      const goals = goalsRaw?.map(goal => ({
        ...goal,
        startDate: goal.startDate ? new Date(goal.startDate) : undefined,
        endDate: goal.endDate ? new Date(goal.endDate) : undefined
      })) || [];

      // Deserialize annotation dates
      const annotations = annotationsRaw?.map(annotation => ({
        ...annotation,
        date: annotation.date ? new Date(annotation.date) : undefined,
        startDate: annotation.startDate ? new Date(annotation.startDate) : undefined,
        endDate: annotation.endDate ? new Date(annotation.endDate) : undefined
      })) || [];

      return {
        id: metric.id,
        series,
        order: metric.order_index,
        goals: goals || [],
        goalsEnabled: false,
        forecast: forecast || { enabled: false, horizon: 90, seasonal: 'none', showConfidenceIntervals: true, confidenceLevel: 95 },
        forecastSnapshot,
        annotations,
        annotationsEnabled: false,
        metricIndex: metric.order_index
      };
    })
  );

  // Extract global settings from aggregation config, or use defaults
  const globalSettingsRecord = configs?.find(c => c.config_type === 'aggregation');
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
    comparisons: [...DEFAULT_SELECTION_COMPARISONS, ...DEFAULT_FOCUS_COMPARISONS],
    selectionIncludesForecast: false,
    focusIncludesForecast: false,
    annotations: [],
    annotationsEnabled: false
  };

  // Ensure comparisons exist even if loaded from old data
  if (!globalSettings.comparisons || globalSettings.comparisons.length === 0) {
    globalSettings.comparisons = [...DEFAULT_SELECTION_COMPARISONS, ...DEFAULT_FOCUS_COMPARISONS];
  }

  // Deserialize focus period dates (they're stored as strings in JSON)
  if (globalSettings.focusPeriod?.startDate) {
    globalSettings.focusPeriod.startDate = new Date(globalSettings.focusPeriod.startDate);
  }
  if (globalSettings.focusPeriod?.endDate) {
    globalSettings.focusPeriod.endDate = new Date(globalSettings.focusPeriod.endDate);
  }

  // Deserialize dateRange dates (for custom date ranges)
  if (globalSettings.dateRange?.startDate) {
    globalSettings.dateRange.startDate = new Date(globalSettings.dateRange.startDate);
  }
  if (globalSettings.dateRange?.endDate) {
    globalSettings.dateRange.endDate = new Date(globalSettings.dateRange.endDate);
  }

  // Deserialize annotation dates
  if (globalSettings.annotations) {
    globalSettings.annotations = globalSettings.annotations.map(annotation => ({
      ...annotation,
      date: annotation.date ? new Date(annotation.date) : undefined,
      startDate: annotation.startDate ? new Date(annotation.startDate) : undefined,
      endDate: annotation.endDate ? new Date(annotation.endDate) : undefined
    }));
  }

  // Deserialize selectionDate (the locked selection for calculations)
  if (globalSettings.selectionDate) {
    globalSettings.selectionDate = new Date(globalSettings.selectionDate as any);
  }

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
      description: input.description,
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
 * Update dashboard last viewed timestamp
 * Called when a dashboard is opened/viewed
 */
export async function updateDashboardViewTime(dashboardId: string): Promise<void> {
  const { error } = await supabase
    .from('dashboards')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', dashboardId);

  if (error) {
    console.error('Error updating dashboard view time:', error);
    // Don't throw - this is a non-critical update
  }
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
 * Uses UPDATE for existing metrics to avoid triggering file deletion
 */
export async function saveDashboardData(
  dashboardId: string,
  metrics: MetricConfig[],
  globalSettings: GlobalSettings
): Promise<void> {
  console.log(`[SAVE] Starting dashboard save: ${dashboardId}`);
  console.log(`[SAVE] Metrics to save: ${metrics.length}`);

  try {
    // Step 1: Fetch existing metrics from database
    const { data: existingMetrics, error: fetchError } = await supabase
      .from('metrics')
      .select('id, data_file_path, name, unit, order_index')
      .eq('dashboard_id', dashboardId);

    if (fetchError) {
      console.error('[SAVE] Error fetching existing metrics:', fetchError);
      throw fetchError;
    }

    console.log(`[SAVE] Found ${existingMetrics?.length || 0} existing metrics in database`);

    // Step 2: Build a map of existing metrics by file path for quick lookup
    const existingByPath = new Map(
      (existingMetrics || []).map(m => [m.data_file_path, m])
    );

    // Step 3: Categorize metrics into update, insert, and delete
    const metricsToUpdate: Array<{ id: string; metric: MetricConfig; index: number }> = [];
    const metricsToInsert: Array<{ metric: MetricConfig; index: number }> = [];
    const currentFilePaths = new Set<string>();

    metrics.forEach((metric, index) => {
      const filePath = metric.series.filePath || '';
      currentFilePaths.add(filePath);

      const existing = existingByPath.get(filePath);
      if (existing) {
        // Metric exists - update it
        metricsToUpdate.push({ id: existing.id, metric, index });
      } else {
        // New metric - insert it
        metricsToInsert.push({ metric, index });
      }
    });

    // Metrics to delete: in database but not in current list
    const metricsToDelete = (existingMetrics || []).filter(
      m => !currentFilePaths.has(m.data_file_path)
    );

    console.log(`[SAVE] Update: ${metricsToUpdate.length}, Insert: ${metricsToInsert.length}, Delete: ${metricsToDelete.length}`);

    // Step 4: Delete removed metrics (will trigger file cleanup via trigger)
    if (metricsToDelete.length > 0) {
      const idsToDelete = metricsToDelete.map(m => m.id);
      console.log(`[SAVE] Deleting ${idsToDelete.length} metrics that were removed`);

      const { error: deleteError } = await supabase
        .from('metrics')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('[SAVE] Error deleting metrics:', deleteError);
        throw deleteError;
      }
    }

    // Step 5: Update existing metrics (NO file deletion triggered)
    const allMetricIds: string[] = [];

    for (const { id, metric, index } of metricsToUpdate) {
      const { error: updateError } = await supabase
        .from('metrics')
        .update({
          name: metric.series.metadata.name,
          unit: metric.series.metadata.numeratorLabel || '',
          order_index: index
          // NOTE: NOT updating data_file_path - it stays the same!
        })
        .eq('id', id);

      if (updateError) {
        console.error('[SAVE] Error updating metric:', updateError);
        throw updateError;
      }

      allMetricIds.push(id);
    }

    console.log(`[SAVE] Updated ${metricsToUpdate.length} existing metrics`);

    // Step 6: Insert new metrics
    if (metricsToInsert.length > 0) {
      const metricRecords = metricsToInsert.map(({ metric, index }) => {
        const filePath = metric.series.filePath || '';
        return {
          dashboard_id: dashboardId,
          name: metric.series.metadata.name,
          unit: metric.series.metadata.numeratorLabel || '',
          data_file_path: filePath,
          order_index: index
        };
      });

      const { data: insertedMetrics, error: insertError } = await supabase
        .from('metrics')
        .insert(metricRecords)
        .select('id');

      if (insertError) {
        console.error('[SAVE] Error inserting metrics:', insertError);
        throw insertError;
      }

      if (insertedMetrics) {
        allMetricIds.push(...insertedMetrics.map(m => m.id));
      }

      console.log(`[SAVE] Inserted ${metricsToInsert.length} new metrics`);
    }

    // Step 7: Delete ALL old configurations and re-create them
    // (simpler than trying to diff configurations)
    if (allMetricIds.length > 0) {
      const { error: deleteConfigError } = await supabase
        .from('metric_configurations')
        .delete()
        .in('metric_id', allMetricIds);

      if (deleteConfigError) {
        console.error('[SAVE] Error deleting old configurations:', deleteConfigError);
        throw deleteConfigError;
      }
    }

    // Step 8: Insert new configurations
    if (allMetricIds.length > 0) {
      const configRecords: any[] = [];

      // Match metrics back to their database IDs
      const updatedMetricsMap = new Map(
        metricsToUpdate.map(({ id, metric }) => [metric.series.filePath, { id, metric }])
      );

      // For inserted metrics, we need to fetch them to get IDs
      const insertedPaths = metricsToInsert.map(({ metric }) => metric.series.filePath);
      let insertedMetricsData: any[] = [];

      if (insertedPaths.length > 0) {
        const { data, error } = await supabase
          .from('metrics')
          .select('id, data_file_path')
          .in('data_file_path', insertedPaths)
          .eq('dashboard_id', dashboardId);

        if (error) {
          console.error('[SAVE] Error fetching inserted metric IDs:', error);
        } else {
          insertedMetricsData = data || [];
        }
      }

      const insertedMetricsMap = new Map(
        insertedMetricsData.map(m => [m.data_file_path, m])
      );

      // Build configurations for all metrics
      metrics.forEach(metric => {
        const filePath = metric.series.filePath || '';
        let metricId: string | undefined;

        // Find the metric ID from either updated or inserted metrics
        const updated = updatedMetricsMap.get(filePath);
        if (updated) {
          metricId = updated.id;
        } else {
          const inserted = insertedMetricsMap.get(filePath);
          if (inserted) {
            metricId = inserted.id;
          }
        }

        if (!metricId) {
          console.warn(`[SAVE] Could not find metric ID for file path: ${filePath}`);
          return;
        }

        // Add goals configuration
        if (metric.goals && metric.goals.length > 0) {
          configRecords.push({
            metric_id: metricId,
            config_type: 'goal',
            config_data: metric.goals
          });
        }

        // Add forecast configuration
        if (metric.forecast) {
          configRecords.push({
            metric_id: metricId,
            config_type: 'forecast',
            config_data: {
              ...metric.forecast,
              snapshot: metric.forecastSnapshot
            }
          });
        }

        // Add annotations
        if (metric.annotations && metric.annotations.length > 0) {
          configRecords.push({
            metric_id: metricId,
            config_type: 'annotation',
            config_data: metric.annotations
          });
        }
      });

      // Add global settings (stored on first metric)
      if (allMetricIds.length > 0) {
        configRecords.push({
          metric_id: allMetricIds[0],
          config_type: 'aggregation',
          config_data: globalSettings
        });
      }

      if (configRecords.length > 0) {
        const { error: configError } = await supabase
          .from('metric_configurations')
          .insert(configRecords);

        if (configError) {
          console.error('[SAVE] Error inserting configurations:', configError);
          throw configError;
        }

        console.log(`[SAVE] Inserted ${configRecords.length} configurations`);
      }
    }

    // Step 9: Update dashboard timestamp
    const { error: updateError } = await supabase
      .from('dashboards')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', dashboardId);

    if (updateError) {
      console.error('[SAVE] Error updating dashboard timestamp:', updateError);
      throw updateError;
    }

    console.log('[SAVE] ✓ Dashboard save complete');
  } catch (error) {
    console.error('[SAVE] ✗ Dashboard save failed:', error);
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
