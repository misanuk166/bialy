import { useState, useEffect, useRef } from 'react';
import type { FocusPeriod } from '../types/focusPeriod';
import { DateInput } from './DateInput';

interface FocusPeriodModalProps {
  focusPeriod: FocusPeriod;
  includesForecast?: boolean;
  dataExtent?: [Date, Date];
  onSave: (focusPeriod: FocusPeriod) => void;
  onIncludesForecastChange?: (includesForecast: boolean) => void;
  onClose: () => void;
  anchorElement?: HTMLElement;
}

export function FocusPeriodModal({
  focusPeriod,
  includesForecast = false,
  dataExtent,
  onSave,
  onIncludesForecastChange,
  onClose,
  anchorElement
}: FocusPeriodModalProps) {
  // Calculate current quarter based on last date in series
  const calculateCurrentQuarter = (date: Date): { label: string; startDate: Date; endDate: Date } => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const quarter = Math.floor(month / 3) + 1;

    // Calculate quarter start and end dates
    const quarterStartMonth = (quarter - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;

    const startDate = new Date(year, quarterStartMonth, 1);
    const endDate = new Date(year, quarterEndMonth + 1, 0); // Last day of the quarter's last month

    return {
      label: `${year} Q${quarter}`,
      startDate,
      endDate
    };
  };

  // Initialize with current quarter if no focus period is set
  const [label, setLabel] = useState(() => {
    if (focusPeriod.label) return focusPeriod.label;
    if (dataExtent && dataExtent[1]) {
      const quarter = calculateCurrentQuarter(dataExtent[1]);
      return quarter.label;
    }
    return '';
  });

  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    if (focusPeriod.startDate) return focusPeriod.startDate;
    if (dataExtent && dataExtent[1]) {
      const quarter = calculateCurrentQuarter(dataExtent[1]);
      return quarter.startDate;
    }
    return undefined;
  });

  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    if (focusPeriod.endDate) return focusPeriod.endDate;
    if (dataExtent && dataExtent[1]) {
      const quarter = calculateCurrentQuarter(dataExtent[1]);
      return quarter.endDate;
    }
    return undefined;
  });

  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleApply = () => {
    const hasData = !!(startDate && endDate);
    onSave({
      enabled: hasData,
      label: label.trim() || undefined,
      startDate: startDate,
      endDate: endDate
    });
    onClose();
  };

  const handleClear = () => {
    onSave({ enabled: false });
    onClose();
  };

  return (
    <div
      ref={popupRef}
      className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
      style={{
        top: anchorElement ? anchorElement.getBoundingClientRect().bottom + 5 : '50%',
        right: anchorElement ? `calc(100vw - ${anchorElement.getBoundingClientRect().right}px)` : 'auto',
        width: '280px'
      }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Q4 2024"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <DateInput
            selected={startDate}
            onChange={(date) => setStartDate(date || undefined)}
            minDate={dataExtent ? dataExtent[0] : undefined}
            maxDate={dataExtent ? dataExtent[1] : undefined}
            placeholderText="Select start date"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            End Date
          </label>
          <DateInput
            selected={endDate}
            onChange={(date) => setEndDate(date || undefined)}
            minDate={startDate || (dataExtent ? dataExtent[0] : undefined)}
            maxDate={dataExtent ? dataExtent[1] : undefined}
            placeholderText="Select end date"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includesForecast}
              onChange={(e) => onIncludesForecastChange?.(e.target.checked)}
              className="cursor-pointer"
            />
            <span>Include forecast in comparisons</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleClear}
          className="flex-1 text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Clear
        </button>
        <button
          onClick={handleApply}
          disabled={!startDate || !endDate}
          className="flex-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
