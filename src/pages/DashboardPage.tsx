import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CSVUpload } from '../components/CSVUpload';
import { MetricGrid } from '../components/MetricGrid';
import { SingleMetricView } from '../components/SingleMetricView';
import { Sidebar } from '../components/Sidebar';
import { DashboardHeader } from '../components/DashboardHeader';
import { ShareDashboardModal } from '../components/ShareDashboardModal';
import { loadSyntheticMetrics } from '../utils/generateSyntheticData';
// ❌ REMOVED localStorage imports - now using database persistence exclusively
import { fetchDashboard, saveDashboardData, updateDashboard, updateDashboardViewTime } from '../services/dashboardService';
import { saveSeriesAsCSV } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import type { Dashboard } from '../types/dashboard';
import type { Series } from '../types/series';
import type { MetricConfig, GlobalSettings, ViewMode } from '../types/appState';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from '../types/shadow';
import type { FocusPeriod } from '../types/focusPeriod';
import type { Annotation } from '../types/annotation';
import type { DateRange } from '../components/RangeControls';
import { DEFAULT_SELECTION_COMPARISONS, DEFAULT_FOCUS_COMPARISONS, type ComparisonConfig } from '../types/comparison';

export function DashboardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [metrics, setMetrics] = useState<MetricConfig[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    aggregation: {
      enabled: true,
      mode: 'groupBy',
      period: 7,
      unit: 'days',
      groupByPeriod: 'week'
    },
    shadows: [],
    averageShadows: false,
    focusPeriod: {
      enabled: false
    },
    dateRange: {
      preset: 'all'
    },
    comparisons: [...DEFAULT_SELECTION_COMPARISONS, ...DEFAULT_FOCUS_COMPARISONS],
    selectionIncludesForecast: false,
    focusIncludesForecast: false,
    annotations: [],
    annotationsEnabled: false
  });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modal states for header controls
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showAggregationModal, setShowAggregationModal] = useState(false);
  const [showShadowModal, setShowShadowModal] = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);

  // Refs for header control buttons (for modal positioning)
  const rangeButtonRef = useRef<HTMLButtonElement>(null);
  const aggregationButtonRef = useRef<HTMLButtonElement>(null);
  const shadowButtonRef = useRef<HTMLButtonElement>(null);
  const annotationButtonRef = useRef<HTMLButtonElement>(null);

  // Read dashboard ID from URL query parameter on mount
  useEffect(() => {
    const dashboardParam = searchParams.get('dashboard');
    if (dashboardParam) {
      setCurrentDashboardId(dashboardParam);
    }
  }, [searchParams]);

  // Load dashboard data when currentDashboardId changes
  useEffect(() => {
    if (!currentDashboardId) return;

    const loadDashboard = async () => {
      try {
        console.log('[DASHBOARD] Starting to load dashboard:', currentDashboardId);
        setIsLoadingDashboard(true);

        const dashboard = await fetchDashboard(currentDashboardId);

        if (dashboard) {
          setCurrentDashboard(dashboard);
          setMetrics(dashboard.metrics);
          setGlobalSettings(dashboard.global_settings);
          console.log('[DASHBOARD] Loaded dashboard with', dashboard.metrics.length, 'metrics');

          // Update last viewed timestamp
          updateDashboardViewTime(currentDashboardId);
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    loadDashboard();
  }, [currentDashboardId]);

  // ❌ REMOVED localStorage fallback - was loading stale data with broken file paths
  // Now using database persistence exclusively via fetchDashboard() above

  // Save dashboard data to database when it changes (debounced)
  useEffect(() => {
    if (!currentDashboardId || metrics.length === 0) return;

    // CRITICAL: Don't save while loading a dashboard
    // This prevents saving stale metrics from the previous dashboard
    if (isLoadingDashboard) {
      console.log('[DASHBOARD] Skipping save - dashboard is loading');
      return;
    }

    const timeoutId = setTimeout(() => {
      saveDashboardData(currentDashboardId, metrics, globalSettings)
        .then(() => {
          console.log('Dashboard data saved');
        })
        .catch((error) => {
          console.error('Failed to save dashboard data:', error);
        });
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [currentDashboardId, metrics, globalSettings, isLoadingDashboard]);

  const handleSeriesLoaded = (series: Series, filePath?: string) => {
    setMetrics(prevMetrics => {
      const newMetric: MetricConfig = {
        id: series.id,
        series: {
          ...series,
          filePath // Store file path with series for later retrieval
        } as any,
        order: prevMetrics.length,
        metricIndex: prevMetrics.length,
        goals: [],
        goalsEnabled: false,
        forecast: {
          enabled: false,
          horizon: 90,
          seasonal: 'none',
          showConfidenceIntervals: true,
          confidenceLevel: 95
        }
      };

      // Add default shadow (1 year ago) when adding the first metric
      if (prevMetrics.length === 0) {
        setGlobalSettings(prev => ({
          ...prev,
          shadows: [{
            id: crypto.randomUUID(),
            enabled: true,
            periods: 1,
            unit: 'year',
            label: '1 year ago'
          }]
        }));
      }

      return [...prevMetrics, newMetric];
    });
  };

  const handleMetricUpdate = (updatedMetric: MetricConfig) => {
    setMetrics(prevMetrics => prevMetrics.map(m => m.id === updatedMetric.id ? updatedMetric : m));
  };

  const handleMetricRemove = (metricId: string) => {
    setMetrics(prevMetrics => {
      if (prevMetrics.length <= 1) {
        // Silently ignore removal of the last metric
        return prevMetrics;
      }
      return prevMetrics.filter(m => m.id !== metricId);
    });
  };

  const handleMetricExpand = (metricId: string) => {
    setExpandedMetricId(metricId);
    setViewMode('single-metric');
  };

  const handleCloseExpandedView = () => {
    setExpandedMetricId(null);
    setViewMode('grid');
  };

  const handleAggregationChange = (config: AggregationConfig) => {
    setGlobalSettings(prev => ({ ...prev, aggregation: config }));
  };

  const handleShadowsChange = (shadows: Shadow[], averageShadows: boolean, shadowsEnabled: boolean) => {
    setGlobalSettings(prev => ({ ...prev, shadows, averageShadows, shadowsEnabled }));
  };

  const handleFocusPeriodChange = (focusPeriod: FocusPeriod) => {
    setGlobalSettings(prev => ({ ...prev, focusPeriod }));
  };

  const handleAnnotationsChange = (annotations: Annotation[], annotationsEnabled: boolean) => {
    setGlobalSettings(prev => ({ ...prev, annotations, annotationsEnabled }));
  };

  const handleDateRangeChange = (dateRange: DateRange) => {
    setGlobalSettings(prev => ({ ...prev, dateRange }));
  };

  const handleSelectionDateChange = (selectionDate: Date | null) => {
    setGlobalSettings(prev => ({ ...prev, selectionDate: selectionDate || undefined }));
  };

  const handleComparisonsChange = (comparisons: ComparisonConfig[]) => {
    setGlobalSettings(prev => ({ ...prev, comparisons }));
  };

  const handleForecastInclusionChange = (selectionIncludes: boolean, focusIncludes: boolean) => {
    setGlobalSettings(prev => ({
      ...prev,
      selectionIncludesForecast: selectionIncludes,
      focusIncludesForecast: focusIncludes
    }));
  };

  const handleAddMetric = () => {
    setShowAddMetricModal(true);
  };

  const handleClearAllMetrics = () => {
    setMetrics([]);
  };

  const handleLoadSyntheticMetrics = async () => {
    if (!user) {
      alert('You must be logged in to load synthetic metrics');
      return;
    }

    const errors: Array<{ metricName: string; error: Error }> = [];
    let successCount = 0;

    try {
      console.log('[SYNTHETIC] Starting synthetic metrics load');

      // Load synthetic metrics
      loadSyntheticMetrics(async (series: Series) => {
        try {
          // Save the series data to Supabase Storage as CSV
          const uploadResult = await saveSeriesAsCSV(series, user.id);

          // Add filePath to series so it gets saved in database
          const seriesWithPath = {
            ...series,
            filePath: uploadResult.path
          } as Series;

          // Pass to the normal handler
          handleSeriesLoaded(seriesWithPath, uploadResult.path);
          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[SYNTHETIC] ✗ Failed to save synthetic metric:`, error);

          errors.push({
            metricName: series.metadata.name,
            error: error instanceof Error ? error : new Error(errorMsg)
          });

          // Don't add the metric if save fails - prevents "No data available" on refresh
          // User will see the error and can retry
        }
      });

      // Give async operations time to complete
      setTimeout(() => {
        if (errors.length > 0) {
          const errorList = errors.map(e => `- ${e.metricName}: ${e.error.message}`).join('\n');
          alert(`⚠️ ${errors.length} metrics failed to upload:\n\n${errorList}\n\nCheck console for details.`);
        } else {
          console.log(`[SYNTHETIC] ✓ All ${successCount} metrics uploaded successfully`);
        }
      }, 2000);
    } catch (error) {
      console.error('[SYNTHETIC] Unexpected error:', error);
      alert('Failed to load synthetic metrics. Check console for details.');
    }
  };

  const handleShareDashboard = (dashboard: Dashboard) => {
    setCurrentDashboard(dashboard);
    setShowShareModal(true);
  };

  const handleDashboardUpdate = (updated: Dashboard) => {
    setCurrentDashboard(updated);
  };

  const handleDashboardMetadataUpdate = async (updates: { name?: string; description?: string }) => {
    if (!currentDashboardId) return;

    try {
      const updatedDashboard = await updateDashboard(currentDashboardId, updates);
      setCurrentDashboard(updatedDashboard);
    } catch (error) {
      console.error('Failed to update dashboard:', error);
      alert('Failed to update dashboard');
    }
  };

  // Get data extent for focus period controls (primary series data only)
  const dataExtent = metrics.length > 0 ? (() => {
    const allDates: Date[] = [];
    metrics.forEach(m => {
      // Only include primary series data (no forecasts, shadows, or goals)
      m.series.data.forEach(d => allDates.push(d.date));
    });
    const extent = allDates.length > 0 ? [
      new Date(Math.min(...allDates.map(d => d.getTime()))),
      new Date(Math.max(...allDates.map(d => d.getTime())))
    ] as [Date, Date] : undefined;
    return extent;
  })() : undefined;

  const expandedMetric = expandedMetricId ? metrics.find(m => m.id === expandedMetricId) : null;

  // Check if current user is the owner of the current dashboard
  const isOwner = !currentDashboard || (user?.id === currentDashboard.owner_id);
  const readOnly = !isOwner;

  return (
    <>
      {/* Sidebar Navigation */}
      <Sidebar
        currentDashboardId={currentDashboardId}
        onShareDashboard={handleShareDashboard}
        onCollapseChange={setIsSidebarCollapsed}
      />

      {/* Main Content Area (with left margin for sidebar) */}
      <div className={`min-h-screen bg-white transition-all duration-300 pl-4 ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Dashboard Header with Controls */}
        {currentDashboard && (
          <DashboardHeader
            dashboardName={currentDashboard.name}
            dashboardDescription={currentDashboard.description}
            readOnly={readOnly}
            onShowRangeModal={() => setShowRangeModal(true)}
            onShowAggregationModal={() => setShowAggregationModal(true)}
            onShowShadowModal={() => setShowShadowModal(true)}
            onShowAnnotationModal={() => setShowAnnotationModal(true)}
            onAddMetric={handleAddMetric}
            onUpdateDashboard={handleDashboardMetadataUpdate}
            rangeButtonRef={rangeButtonRef}
            aggregationButtonRef={aggregationButtonRef}
            shadowButtonRef={shadowButtonRef}
            annotationButtonRef={annotationButtonRef}
          />
        )}

        {/* Share Modal */}
        {showShareModal && currentDashboard && (
          <ShareDashboardModal
            dashboard={currentDashboard}
            onClose={() => setShowShareModal(false)}
            onUpdate={handleDashboardUpdate}
          />
        )}

        {/* Single Metric Expanded View */}
        {viewMode === 'single-metric' && expandedMetric && (
          <div>
            <SingleMetricView
              metric={expandedMetric}
              globalSettings={globalSettings}
              onClose={handleCloseExpandedView}
              onMetricUpdate={handleMetricUpdate}
            />
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div>
            {metrics.length === 0 ? (
              <div className="space-y-4 mx-8 mt-6 mb-8">
                <div className="bg-white rounded-lg shadow p-8">
                  <CSVUpload onSeriesLoaded={handleSeriesLoaded} />
                  <div className="text-center mt-6">
                    <p className="text-gray-600 mb-2">or</p>
                    <button
                      onClick={handleLoadSyntheticMetrics}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Load 10 Synthetic Metrics (2.5 years of data)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Read-only indicator */}
                {readOnly && (
                  <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Read-Only Mode:</strong> You are viewing this dashboard. Only the owner can make changes.
                    </p>
                  </div>
                )}

                {/* Metric Grid */}
                <MetricGrid
                  metrics={metrics}
                  globalSettings={globalSettings}
                  dataExtent={dataExtent}
                  readOnly={readOnly}
                  onMetricsReorder={setMetrics}
                  onMetricUpdate={handleMetricUpdate}
                  onMetricRemove={handleMetricRemove}
                  onMetricExpand={handleMetricExpand}
                  onAggregationChange={handleAggregationChange}
                  onShadowsChange={handleShadowsChange}
                  onFocusPeriodChange={handleFocusPeriodChange}
                  onDateRangeChange={handleDateRangeChange}
                  onSelectionDateChange={handleSelectionDateChange}
                  onComparisonsChange={handleComparisonsChange}
                  onForecastInclusionChange={handleForecastInclusionChange}
                  onAnnotationsChange={handleAnnotationsChange}
                  onAddMetric={handleAddMetric}
                  onClearAllMetrics={handleClearAllMetrics}
                  // Pass modal state handlers for header controls
                  showRangeModal={showRangeModal}
                  onCloseRangeModal={() => setShowRangeModal(false)}
                  showAggregationModal={showAggregationModal}
                  onCloseAggregationModal={() => setShowAggregationModal(false)}
                  showShadowModal={showShadowModal}
                  onCloseShadowModal={() => setShowShadowModal(false)}
                  showAnnotationModal={showAnnotationModal}
                  onCloseAnnotationModal={() => setShowAnnotationModal(false)}
                  // Pass button refs for modal positioning
                  rangeButtonRef={rangeButtonRef}
                  aggregationButtonRef={aggregationButtonRef}
                  shadowButtonRef={shadowButtonRef}
                  annotationButtonRef={annotationButtonRef}
                />

                {/* Add Metric Modal */}
                {showAddMetricModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Add Metric</h2>
                        <button
                          onClick={() => setShowAddMetricModal(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                      <CSVUpload onSeriesLoaded={(series) => {
                        handleSeriesLoaded(series);
                        setShowAddMetricModal(false);
                      }} />
                      <div className="mt-4 text-center">
                        <p className="text-gray-600 mb-2">or</p>
                        <button
                          onClick={() => {
                            handleLoadSyntheticMetrics();
                            setShowAddMetricModal(false);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Add Synthetic Metric
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
