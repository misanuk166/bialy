import { useState } from 'react';
import type { FocusPeriod } from '../types/focusPeriod';

interface FocusPeriodControlsProps {
  focusPeriod: FocusPeriod;
  onChange: (focusPeriod: FocusPeriod) => void;
  dataExtent?: [Date, Date]; // Min and max dates from the data
}

export function FocusPeriodControls({ focusPeriod, onChange, dataExtent }: FocusPeriodControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = () => {
    const newEnabled = !focusPeriod.enabled;
    // Auto-expand when toggling on
    if (newEnabled) {
      setIsExpanded(true);
    }
    onChange({ ...focusPeriod, enabled: newEnabled });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const startDate = e.target.value ? new Date(e.target.value) : undefined;
    onChange({ ...focusPeriod, startDate });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const endDate = e.target.value ? new Date(e.target.value) : undefined;
    onChange({ ...focusPeriod, endDate });
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const label = e.target.value || undefined;
    onChange({ ...focusPeriod, label });
  };

  // Format date for input field (YYYY-MM-DD) - same as GoalControls
  const formatDateForInput = (date?: Date): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
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
          <h3 className="text-lg font-semibold text-gray-900">Focus Period</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={focusPeriod.enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {focusPeriod.enabled && isExpanded && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Select a date range to analyze independently from mouse-over
          </p>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (optional)
            </label>
            <input
              type="text"
              value={focusPeriod.label || ''}
              onChange={handleLabelChange}
              placeholder="e.g., Summer 2024, Q1, Peak Season"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={formatDateForInput(focusPeriod.startDate)}
              onChange={handleStartDateChange}
              min={dataExtent ? formatDateForInput(dataExtent[0]) : undefined}
              max={dataExtent ? formatDateForInput(dataExtent[1]) : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={formatDateForInput(focusPeriod.endDate)}
              onChange={handleEndDateChange}
              min={dataExtent ? formatDateForInput(dataExtent[0]) : undefined}
              max={dataExtent ? formatDateForInput(dataExtent[1]) : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          {focusPeriod.startDate && focusPeriod.endDate && (
            <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
              <span className="font-semibold">Period: </span>
              {focusPeriod.startDate.toLocaleDateString()} to {focusPeriod.endDate.toLocaleDateString()}
              {' '}
              ({Math.ceil((focusPeriod.endDate.getTime() - focusPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24))} days)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
