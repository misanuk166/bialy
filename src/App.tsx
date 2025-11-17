import { useState } from 'react';
import { CSVUpload } from './components/CSVUpload';
import { GlobalControlPanel } from './components/GlobalControlPanel';
import { MetricGrid } from './components/MetricGrid';
import { SingleMetricView } from './components/SingleMetricView';
import type { Series } from './types/series';
import type { MetricConfig, GlobalSettings, ViewMode } from './types/appState';
import type { AggregationConfig } from './utils/aggregation';
import type { Shadow } from './types/shadow';
import type { FocusPeriod } from './types/focusPeriod';

function App() {
  const [metrics, setMetrics] = useState<MetricConfig[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    aggregation: {
      enabled: false,
      mode: 'smoothing',
      period: 7,
      unit: 'days',
      groupByPeriod: 'month'
    },
    shadows: [],
    averageShadows: false,
    focusPeriod: {
      enabled: false
    }
  });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);

  const handleSeriesLoaded = (series: Series) => {
    const newMetric: MetricConfig = {
      id: series.id,
      series,
      order: metrics.length,
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
    setMetrics([...metrics, newMetric]);
  };

  const handleMetricUpdate = (updatedMetric: MetricConfig) => {
    setMetrics(metrics.map(m => m.id === updatedMetric.id ? updatedMetric : m));
  };

  const handleMetricRemove = (metricId: string) => {
    if (metrics.length <= 1) {
      alert('Cannot remove the last metric');
      return;
    }
    if (confirm('Are you sure you want to remove this metric?')) {
      setMetrics(metrics.filter(m => m.id !== metricId));
    }
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
    setGlobalSettings({ ...globalSettings, aggregation: config });
  };

  const handleShadowsChange = (shadows: Shadow[], averageShadows: boolean) => {
    setGlobalSettings({ ...globalSettings, shadows, averageShadows });
  };

  const handleFocusPeriodChange = (focusPeriod: FocusPeriod) => {
    setGlobalSettings({ ...globalSettings, focusPeriod });
  };

  // Get data extent for focus period controls
  const dataExtent = metrics.length > 0 ? (() => {
    const allDates: Date[] = [];
    metrics.forEach(m => m.series.data.forEach(d => allDates.push(d.date)));
    return allDates.length > 0 ? [
      new Date(Math.min(...allDates.map(d => d.getTime()))),
      new Date(Math.max(...allDates.map(d => d.getTime())))
    ] as [Date, Date] : undefined;
  })() : undefined;

  const expandedMetric = expandedMetricId ? metrics.find(m => m.id === expandedMetricId) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="mx-auto px-6" style={{ maxWidth: '2000px' }}>
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900">Bialy</h1>
          <p className="text-gray-600 mt-2">
            Multi-metric time series data visualization and analysis
          </p>
        </header>

        {/* Single Metric Expanded View */}
        {viewMode === 'single-metric' && expandedMetric && (
          <SingleMetricView
            metric={expandedMetric}
            globalSettings={globalSettings}
            onClose={handleCloseExpandedView}
            onMetricUpdate={handleMetricUpdate}
          />
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <>
            {metrics.length === 0 ? (
              <CSVUpload onSeriesLoaded={handleSeriesLoaded} />
            ) : (
              <div className="space-y-6">
                {/* Global Controls */}
                <GlobalControlPanel
                  settings={globalSettings}
                  dataExtent={dataExtent}
                  onAggregationChange={handleAggregationChange}
                  onShadowsChange={handleShadowsChange}
                  onFocusPeriodChange={handleFocusPeriodChange}
                />

                {/* Metric Grid */}
                <MetricGrid
                  metrics={metrics}
                  globalSettings={globalSettings}
                  onMetricsReorder={setMetrics}
                  onMetricUpdate={handleMetricUpdate}
                  onMetricRemove={handleMetricRemove}
                  onMetricExpand={handleMetricExpand}
                />

                {/* Add Metric Button */}
                <div className="flex justify-center gap-4">
                  <CSVUpload onSeriesLoaded={handleSeriesLoaded} />
                  {metrics.length > 0 && (
                    <button
                      onClick={() => setMetrics([])}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Clear All Metrics
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
