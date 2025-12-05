import { useState } from 'react';
import { CSVUpload } from './components/CSVUpload';
import { MetricGrid } from './components/MetricGrid';
import { SingleMetricView } from './components/SingleMetricView';
import { loadSyntheticMetrics } from './utils/generateSyntheticData';
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
  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [title, setTitle] = useState('Bialy');
  const [description, setDescription] = useState('Multi-metric time series data visualization and analysis');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const handleSeriesLoaded = (series: Series) => {
    setMetrics(prevMetrics => {
      const newMetric: MetricConfig = {
        id: series.id,
        series,
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
      return [...prevMetrics, newMetric];
    });
  };

  const handleMetricUpdate = (updatedMetric: MetricConfig) => {
    setMetrics(prevMetrics => prevMetrics.map(m => m.id === updatedMetric.id ? updatedMetric : m));
  };

  const handleMetricRemove = (metricId: string) => {
    setMetrics(prevMetrics => {
      if (prevMetrics.length <= 1) {
        alert('Cannot remove the last metric');
        return prevMetrics;
      }
      if (confirm('Are you sure you want to remove this metric?')) {
        return prevMetrics.filter(m => m.id !== metricId);
      }
      return prevMetrics;
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

  const handleShadowsChange = (shadows: Shadow[], averageShadows: boolean) => {
    setGlobalSettings(prev => ({ ...prev, shadows, averageShadows }));
  };

  const handleFocusPeriodChange = (focusPeriod: FocusPeriod) => {
    setGlobalSettings(prev => ({ ...prev, focusPeriod }));
  };

  const handleAddMetric = () => {
    setShowAddMetricModal(true);
  };

  const handleClearAllMetrics = () => {
    if (confirm('Are you sure you want to clear all metrics?')) {
      setMetrics([]);
    }
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
    <div className="min-h-screen bg-white py-1">
      <div className="mx-auto px-1" style={{ maxWidth: '2000px' }}>
        <header className="mb-1">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="text-4xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent outline-none"
            />
          ) : (
            <h1
              className="text-4xl font-bold text-gray-900 cursor-pointer hover:bg-gray-100 inline-block px-2 rounded"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title"
            >
              {title}
            </h1>
          )}
          {isEditingDescription ? (
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => setIsEditingDescription(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditingDescription(false);
                }
              }}
              autoFocus
              className="text-gray-600 mt-2 border-b-2 border-blue-500 bg-transparent outline-none w-full"
            />
          ) : (
            <p
              className="text-gray-600 mt-2 cursor-pointer hover:bg-gray-100 inline-block px-2 rounded"
              onClick={() => setIsEditingDescription(true)}
              title="Click to edit description"
            >
              {description}
            </p>
          )}
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
              <div className="space-y-4">
                <CSVUpload onSeriesLoaded={handleSeriesLoaded} />
                <div className="text-center">
                  <p className="text-gray-600 mb-2">or</p>
                  <button
                    onClick={() => loadSyntheticMetrics(handleSeriesLoaded)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Load 10 Synthetic Metrics (2.5 years of data)
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Metric Grid */}
                <MetricGrid
                  metrics={metrics}
                  globalSettings={globalSettings}
                  dataExtent={dataExtent}
                  onMetricsReorder={setMetrics}
                  onMetricUpdate={handleMetricUpdate}
                  onMetricRemove={handleMetricRemove}
                  onMetricExpand={handleMetricExpand}
                  onAggregationChange={handleAggregationChange}
                  onShadowsChange={handleShadowsChange}
                  onFocusPeriodChange={handleFocusPeriodChange}
                  onAddMetric={handleAddMetric}
                  onClearAllMetrics={handleClearAllMetrics}
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
                            loadSyntheticMetrics(handleSeriesLoaded);
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
          </>
        )}
      </div>
    </div>
  );
}

export default App;
