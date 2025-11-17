import React from 'react';
import type { AggregationConfig, TimeUnit, GroupByPeriod, AggregationMode } from '../utils/aggregation';

interface AggregateControlsProps {
  config: AggregationConfig;
  onChange: (config: AggregationConfig) => void;
}

export function AggregateControls({ config, onChange }: AggregateControlsProps) {
  const handleModeChange = (mode: AggregationMode) => {
    onChange({ ...config, mode, enabled: true });
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const period = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
    onChange({ ...config, period, enabled: true });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...config, unit: e.target.value as TimeUnit, enabled: true });
  };

  const handleGroupByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...config, groupByPeriod: e.target.value as GroupByPeriod, enabled: true });
  };

  const handleDisable = () => {
    onChange({ ...config, enabled: false });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Aggregation Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange('smoothing')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  config.mode === 'smoothing'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Smoothing
              </button>
              <button
                onClick={() => handleModeChange('groupBy')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  config.mode === 'groupBy'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Group By
              </button>
            </div>
          </div>

          {/* Smoothing Options */}
          {config.mode === 'smoothing' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Apply rolling average to smooth the time series data
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={config.period}
                    onChange={handlePeriodChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Unit
                  </label>
                  <select
                    value={config.unit}
                    onChange={handleUnitChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>
              <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                Rolling average: <span className="font-semibold">{config.period} {config.unit}</span>
              </div>
            </div>
          )}

          {/* Group By Options */}
          {config.mode === 'groupBy' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Group data points by time period
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group By Period
                </label>
                <select
                  value={config.groupByPeriod}
                  onChange={handleGroupByChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
              </div>
              <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                Grouping by: <span className="font-semibold">{config.groupByPeriod}</span>
              </div>
            </div>
          )}
        </div>

        {/* Disable Button */}
        {config.enabled && (
          <button
            onClick={handleDisable}
            className="w-full text-sm px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Disable Aggregation
          </button>
        )}
    </div>
  );
}
