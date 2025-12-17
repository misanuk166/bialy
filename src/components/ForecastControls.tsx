import { useState } from 'react';
import type { ForecastConfig } from '../types/forecast';

interface ForecastControlsProps {
  config: ForecastConfig;
  onChange: (config: ForecastConfig) => void;
  onRefreshSnapshot?: () => void;
  snapshotAge?: string; // e.g., "2 hours ago"
}

export function ForecastControls({ config, onChange, onRefreshSnapshot, snapshotAge }: ForecastControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = () => {
    const newEnabled = !config.enabled;
    // Auto-expand when toggling on
    if (newEnabled) {
      setIsExpanded(true);
    }
    onChange({ ...config, enabled: newEnabled });
  };

  const handleHorizonChange = (horizon: number) => {
    onChange({ ...config, horizon });
  };

  const handleSeasonalChange = (seasonal: 'additive' | 'multiplicative' | 'none') => {
    onChange({ ...config, seasonal });
  };

  const handleSeasonLengthChange = (value: string) => {
    const seasonLength = value ? parseInt(value, 10) : undefined;
    onChange({ ...config, seasonLength });
  };

  const handleConfidenceToggle = () => {
    onChange({ ...config, showConfidenceIntervals: !config.showConfidenceIntervals });
  };

  const handleConfidenceLevelChange = (confidenceLevel: number) => {
    onChange({ ...config, confidenceLevel });
  };

  const handleTypeChange = (type: 'auto' | 'manual') => {
    onChange({ ...config, type });
  };

  const handleTargetValueChange = (value: string) => {
    const targetValue = value ? parseFloat(value) : undefined;
    onChange({ ...config, targetValue });
  };

  const handleInterpolationChange = (interpolation: 'linear' | 'exponential') => {
    onChange({ ...config, interpolation });
  };

  const handleStartDateChange = (value: string) => {
    const startDate = value ? new Date(value) : undefined;
    onChange({ ...config, startDate });
  };

  // Calculate days to end of quarter, end of year, and 1 year from start date
  const calculateHorizonDays = (type: 'EOQ' | 'EOY' | '1-year'): number => {
    const today = config.startDate || new Date();

    if (type === '1-year') {
      return 365;
    }

    if (type === 'EOY') {
      const endOfYear = new Date(today.getFullYear(), 11, 31); // Dec 31
      const diffTime = endOfYear.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    if (type === 'EOQ') {
      const currentMonth = today.getMonth();
      const currentQuarter = Math.floor(currentMonth / 3);
      const endOfQuarterMonth = (currentQuarter + 1) * 3 - 1; // Last month of quarter (2, 5, 8, 11)
      const endOfQuarter = new Date(today.getFullYear(), endOfQuarterMonth + 1, 0); // Last day of that month
      const diffTime = endOfQuarter.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return 90; // fallback
  };

  const horizonOptions: Array<{ label: string; type: 'EOQ' | 'EOY' | '1-year'; days: number }> = [
    { label: 'EOQ', type: 'EOQ', days: calculateHorizonDays('EOQ') },
    { label: 'EOY', type: 'EOY', days: calculateHorizonDays('EOY') },
    { label: '1-year', type: '1-year', days: calculateHorizonDays('1-year') }
  ];

  const confidenceLevels = [90, 95, 99];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Forecast</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {config.enabled && isExpanded && (
        <div className="space-y-2">
          {/* Forecast Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Forecast Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTypeChange('auto')}
                className={`px-2 py-1 text-xs rounded transition-colors ${config.type === 'auto'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Auto
              </button>
              <button
                onClick={() => handleTypeChange('manual')}
                className={`px-2 py-1 text-xs rounded transition-colors ${config.type === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Manual
              </button>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={config.startDate ? config.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
            />
          </div>

          {/* Forecast Horizon */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Forecast Horizon
            </label>
            <div className="grid grid-cols-3 gap-2">
              {horizonOptions.map(option => {
                // Find if this option is selected by checking if horizon is close to this option's days
                // Allow 5 day tolerance for EOQ/EOY since they change daily
                const isSelected = Math.abs(config.horizon - option.days) <= 5;

                return (
                  <button
                    key={option.type}
                    onClick={() => handleHorizonChange(option.days)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    title={`${option.days} days`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual Forecast Settings */}
          {config.type === 'manual' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target Value
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 75"
                  value={config.targetValue || ''}
                  onChange={(e) => handleTargetValueChange(e.target.value)}
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Interpolation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleInterpolationChange('linear')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${config.interpolation === 'linear'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    Linear
                  </button>
                  <button
                    onClick={() => handleInterpolationChange('exponential')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${config.interpolation === 'exponential'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    Exponential
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Auto Forecast Settings */}
          {config.type === 'auto' && (
            <>
              {/* Seasonality */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Seasonality
                </label>
                <select
                  value={config.seasonal}
                  onChange={(e) => handleSeasonalChange(e.target.value as 'additive' | 'multiplicative' | 'none')}
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
                >
                  <option value="none">None</option>
                  <option value="additive">Additive</option>
                  <option value="multiplicative">Multiplicative</option>
                </select>
              </div>

              {/* Season Length (only show if seasonality is enabled) */}
              {config.seasonal !== 'none' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Season Length (optional)
                  </label>
                  <input
                    type="number"
                    min="2"
                    placeholder="Auto-detect"
                    value={config.seasonLength || ''}
                    onChange={(e) => handleSeasonLengthChange(e.target.value)}
                    className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
              )}
            </>
          )}

          {/* Confidence Intervals (for all types) */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={config.showConfidenceIntervals}
                onChange={handleConfidenceToggle}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded"
              />
              Show Confidence Intervals
            </label>
          </div>

          {/* Confidence Level */}
          {config.showConfidenceIntervals && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Confidence Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {confidenceLevels.map(level => (
                  <button
                    key={level}
                    onClick={() => handleConfidenceLevelChange(level)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${config.confidenceLevel === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {level}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Refresh Forecast Button */}
          {onRefreshSnapshot && (
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={onRefreshSnapshot}
                className="w-full px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Refresh Forecast Snapshot
              </button>
              {snapshotAge && (
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Last updated: {snapshotAge}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
