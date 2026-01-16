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

  const handleToggle = () => {
    onChange({ ...config, enabled: !config.enabled });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">
          Enable Aggregation
        </label>
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

      <div className="h-px bg-gray-200"></div>

      <div className={`space-y-3 relative transition-opacity ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {!config.enabled && (
          <div className="absolute inset-0 bg-white/60 rounded z-10"></div>
        )}

        {/* Mode Selection */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Aggregation Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange('smoothing')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${config.mode === 'smoothing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Smoothing
            </button>
            <button
              onClick={() => handleModeChange('groupBy')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${config.mode === 'groupBy'
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Period
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={config.period}
                  onChange={handlePeriodChange}
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Time Unit
                </label>
                <select
                  value={config.unit}
                  onChange={handleUnitChange}
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Group By Options */}
        {config.mode === 'groupBy' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Group By Period
              </label>
              <select
                value={config.groupByPeriod}
                onChange={handleGroupByChange}
                className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
