import React from 'react';
import type { Shadow, ShadowPeriodUnit } from '../types/shadow';
import { createShadow } from '../utils/shadows';

interface ShadowControlsProps {
  shadows: Shadow[];
  onChange: (shadows: Shadow[]) => void;
  maxShadows?: number;
  averageTogether?: boolean;
  onAverageTogetherChange?: (enabled: boolean) => void;
}

export function ShadowControls({
  onChange,
  maxShadows = 10,
  averageTogether = false,
  onAverageTogetherChange
}: ShadowControlsProps) {
  const [enabled, setEnabled] = React.useState(false);
  const [period, setPeriod] = React.useState(1);
  const [unit, setUnit] = React.useState<ShadowPeriodUnit>('year');
  const [count, setCount] = React.useState(1);
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Generate shadows based on current settings
  React.useEffect(() => {
    if (!enabled) {
      onChange([]);
      return;
    }

    const newShadows: Shadow[] = [];
    for (let i = 1; i <= count; i++) {
      const totalPeriods = period * i;
      const label = `${totalPeriods} ${unit}${totalPeriods > 1 ? 's' : ''} ago`;
      newShadows.push(createShadow(totalPeriods, unit, label));
    }
    onChange(newShadows);
  }, [enabled, period, unit, count, onChange]);

  const handleToggle = () => {
    setEnabled(!enabled);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPeriod = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
    setPeriod(newPeriod);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUnit(e.target.value as ShadowPeriodUnit);
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = Math.max(1, Math.min(maxShadows, parseInt(e.target.value) || 1));
    setCount(newCount);
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
          <h3 className="text-lg font-semibold text-gray-900">Shadows</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {enabled && isExpanded && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Compare current data with historical periods
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={period}
                onChange={handlePeriodChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Unit
              </label>
              <select
                value={unit}
                onChange={handleUnitChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="day">Days</option>
                <option value="week">Weeks</option>
                <option value="month">Months</option>
                <option value="quarter">Quarters</option>
                <option value="year">Years</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Shadows
              </label>
              <input
                type="number"
                min="1"
                max={maxShadows}
                value={count}
                onChange={handleCountChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {count > 1 && onAverageTogetherChange && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-700">
                  Average together
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={averageTogether}
                    onChange={(e) => onAverageTogetherChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            )}
          </div>

          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded space-y-1">
            <div className="font-semibold">Showing {count} shadow{count > 1 ? 's' : ''}:</div>
            {Array.from({ length: count }, (_, i) => {
              const totalPeriods = period * (i + 1);
              return (
                <div key={i} className="text-xs">
                  • {totalPeriods} {unit}{totalPeriods > 1 ? 's' : ''} ago
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
