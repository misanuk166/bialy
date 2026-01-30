import { useState } from 'react';
import type { ForecastConfig } from '../types/forecast';
import { DateInput } from './DateInput';

interface ForecastControlsProps {
  config: ForecastConfig;
  onChange: (config: ForecastConfig) => void;
  onRefreshSnapshot?: () => void;
  snapshotAge?: string; // e.g., "2 hours ago"
  isGenerating?: boolean; // Loading state when generating forecast
  usingAPI?: boolean; // Whether API forecast is being used
  modelUsed?: string; // Model name from API (e.g., "AutoETS")
  computationTime?: number; // Computation time in ms
}

type SeasonPreset = 'auto' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export function ForecastControls({
  config,
  onChange,
  onRefreshSnapshot,
  snapshotAge,
  isGenerating = false,
  usingAPI = false,
  modelUsed,
  computationTime
}: ForecastControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine current season preset based on config.seasonLength
  const getCurrentSeasonPreset = (): SeasonPreset => {
    if (!config.seasonLength) return 'auto';
    if (config.seasonLength === 7) return 'weekly';
    if (config.seasonLength === 30) return 'monthly';
    if (config.seasonLength === 365) return 'yearly';
    return 'custom';
  };

  const [seasonPreset, setSeasonPreset] = useState<SeasonPreset>(getCurrentSeasonPreset());

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

  const handleModelChange = (model: 'auto' | 'arima' | 'ets' | 'theta') => {
    onChange({ ...config, model });
  };

  const handleSeasonPresetChange = (preset: SeasonPreset) => {
    setSeasonPreset(preset);

    // Update config based on preset
    let newSeasonLength: number | undefined;
    if (preset === 'auto') newSeasonLength = undefined;
    else if (preset === 'weekly') newSeasonLength = 7;
    else if (preset === 'monthly') newSeasonLength = 30;
    else if (preset === 'yearly') newSeasonLength = 365;
    else newSeasonLength = config.seasonLength; // Keep current for custom

    onChange({ ...config, seasonLength: newSeasonLength });
  };

  const handleCustomSeasonLengthChange = (value: string) => {
    const seasonLength = value ? parseInt(value, 10) : undefined;
    onChange({ ...config, seasonLength });
  };

  const handleConfidenceToggle = () => {
    onChange({ ...config, showConfidenceIntervals: !config.showConfidenceIntervals });
  };

  const handleConfidenceLevelChange = (confidenceLevel: number) => {
    onChange({ ...config, confidenceLevel });
  };

  const handleStartDateChange = (date: Date | null) => {
    onChange({ ...config, startDate: date || undefined });
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
          {/* Model Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Model
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleModelChange('auto')}
                className={`px-2 py-1 text-xs rounded transition-colors ${config.model === 'auto'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Auto
              </button>
              <button
                onClick={() => handleModelChange('arima')}
                className={`px-2 py-1 text-xs rounded transition-colors ${config.model === 'arima'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                ARIMA
              </button>
              <button
                onClick={() => handleModelChange('ets')}
                className={`px-2 py-1 text-xs rounded transition-colors ${config.model === 'ets'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                ETS
              </button>
              <button
                onClick={() => handleModelChange('theta')}
                className={`px-2 py-1 text-xs rounded transition-colors ${config.model === 'theta'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Theta
              </button>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <DateInput
              selected={config.startDate}
              onChange={handleStartDateChange}
              placeholderText="Select start date"
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

          {/* Season Length */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Season Length
            </label>
            <select
              value={seasonPreset}
              onChange={(e) => handleSeasonPresetChange(e.target.value as SeasonPreset)}
              className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
            >
              <option value="auto">Auto</option>
              <option value="weekly">Weekly (7)</option>
              <option value="monthly">Monthly (30)</option>
              <option value="yearly">Yearly (365)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Custom Season Length Input */}
          {seasonPreset === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Custom Season Length
              </label>
              <input
                type="number"
                min="2"
                placeholder="e.g., 12"
                value={config.seasonLength || ''}
                onChange={(e) => handleCustomSeasonLengthChange(e.target.value)}
                className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
              />
            </div>
          )}

          {/* Confidence Intervals */}
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

          {/* Forecast Status & Controls */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            {/* API Status Badge */}
            {usingAPI && modelUsed && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Method:</span>
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                    API: {modelUsed}
                  </span>
                  {computationTime && (
                    <span className="text-gray-400">({computationTime.toFixed(0)}ms)</span>
                  )}
                </div>
              </div>
            )}
            {!usingAPI && config.enabled && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Method:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                  Client-side
                </span>
              </div>
            )}

            {/* Generate/Refresh Button */}
            {onRefreshSnapshot && (
              <div>
                <button
                  onClick={onRefreshSnapshot}
                  disabled={isGenerating}
                  className="w-full px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    'Generate Forecast'
                  )}
                </button>
                {snapshotAge && !isGenerating && (
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Last updated: {snapshotAge}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
