import { useState } from 'react';
import type { ForecastConfig } from '../types/forecast';

interface ForecastControlsProps {
  config: ForecastConfig;
  onChange: (config: ForecastConfig) => void;
}

export function ForecastControls({ config, onChange }: ForecastControlsProps) {
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

  const horizonOptions = [7, 30, 90, 365];
  const confidenceLevels = [90, 95, 99];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900">Forecast</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {config.enabled && isExpanded && (
        <div className="p-4 space-y-4">
          {/* Forecast Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTypeChange('auto')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  config.type === 'auto'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => handleTypeChange('manual')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  config.type === 'manual'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {/* Forecast Horizon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Horizon
            </label>
            <div className="grid grid-cols-4 gap-2">
              {horizonOptions.map(days => (
                <button
                  key={days}
                  onClick={() => handleHorizonChange(days)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    config.horizon === days
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Manual Forecast Settings */}
          {config.type === 'manual' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Value
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 75"
                  value={config.targetValue || ''}
                  onChange={(e) => handleTargetValueChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The value you want to reach at the end of the forecast period
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interpolation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleInterpolationChange('linear')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      config.interpolation === 'linear'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    Linear
                  </button>
                  <button
                    onClick={() => handleInterpolationChange('exponential')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      config.interpolation === 'exponential'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seasonality
                </label>
                <select
                  value={config.seasonal}
                  onChange={(e) => handleSeasonalChange(e.target.value as 'additive' | 'multiplicative' | 'none')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="additive">Additive</option>
                  <option value="multiplicative">Multiplicative</option>
                </select>
              </div>

              {/* Season Length (only show if seasonality is enabled) */}
              {config.seasonal !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Season Length (optional)
                  </label>
                  <input
                    type="number"
                    min="2"
                    placeholder="Auto-detect"
                    value={config.seasonLength || ''}
                    onChange={(e) => handleSeasonLengthChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    e.g., 7 for weekly, 30 for monthly
                  </p>
                </div>
              )}
            </>
          )}

          {/* Confidence Intervals (for all types) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={config.showConfidenceIntervals}
                onChange={handleConfidenceToggle}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              Show Confidence Intervals
            </label>
          </div>

          {/* Confidence Level */}
          {config.showConfidenceIntervals && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {confidenceLevels.map(level => (
                  <button
                    key={level}
                    onClick={() => handleConfidenceLevelChange(level)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      config.confidenceLevel === level
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {level}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info text */}
          {config.enabled && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                {config.type === 'manual'
                  ? `Manual forecast with ${config.interpolation} interpolation to target value`
                  : `Using ${config.seasonal !== 'none' ? 'Holt-Winters' : 'Exponential Smoothing'} method${config.seasonal !== 'none' ? ` with ${config.seasonal} seasonality` : ''}`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
