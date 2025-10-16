import React from 'react';
import type { SmoothingConfig, TimeUnit } from '../utils/smoothing';

interface SmoothingControlsProps {
  config: SmoothingConfig;
  onChange: (config: SmoothingConfig) => void;
}

export function SmoothingControls({ config, onChange }: SmoothingControlsProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const handleToggle = () => {
    onChange({ ...config, enabled: !config.enabled });
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const period = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
    onChange({ ...config, period });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...config, unit: e.target.value as TimeUnit });
  };

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
          <h3 className="text-lg font-semibold text-gray-900">Smoothing</h3>
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
    </div>
  );
}
