import { useEffect } from 'react';
import { TimeSeriesChart } from './TimeSeriesChart';
import { GoalControls } from './GoalControls';
import { ForecastControls } from './ForecastControls';
import type { MetricConfig, GlobalSettings } from '../types/appState';

interface SingleMetricViewProps {
  metric: MetricConfig;
  globalSettings: GlobalSettings;
  onClose: () => void;
  onMetricUpdate: (metric: MetricConfig) => void;
}

export function SingleMetricView({
  metric,
  globalSettings,
  onClose,
  onMetricUpdate
}: SingleMetricViewProps) {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="mx-auto px-6 py-6" style={{ maxWidth: '1800px' }}>
        {/* Back Button */}
        <button
          onClick={onClose}
          className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          ← Back to Grid
        </button>

        {/* Main Content */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div className="bg-gray-100 p-3 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Global Controls</h3>
                <p className="text-xs text-gray-600">
                  Aggregation, Shadows, and Focus Period are controlled globally.
                  Return to grid view to modify.
                </p>
              </div>

              <GoalControls
                goals={metric.goals || []}
                onChange={(goals) => onMetricUpdate({ ...metric, goals })}
                enabled={metric.goalsEnabled || false}
                onEnabledChange={(enabled) => onMetricUpdate({ ...metric, goalsEnabled: enabled })}
              />

              <ForecastControls
                config={metric.forecast || {
                  enabled: false,
                  horizon: 90,
                  seasonal: 'none',
                  showConfidenceIntervals: true,
                  confidenceLevel: 95
                }}
                onChange={(config) => onMetricUpdate({ ...metric, forecast: config })}
              />
            </div>

            {/* Chart */}
            <div className="w-full">
              <TimeSeriesChart
                series={metric.series}
                aggregationConfig={globalSettings.aggregation}
                shadows={globalSettings.shadows}
                shadowsEnabled={globalSettings.shadowsEnabled}
                averageShadows={globalSettings.averageShadows}
                goals={metric.goalsEnabled ? metric.goals : []}
                forecastConfig={metric.forecast}
                forecastSnapshot={metric.forecastSnapshot}
                focusPeriod={globalSettings.focusPeriod}
                annotations={globalSettings.annotations}
                annotationsEnabled={globalSettings.annotationsEnabled}
                metricAnnotations={metric.annotations}
                onSeriesUpdate={(series) => onMetricUpdate({ ...metric, series })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
