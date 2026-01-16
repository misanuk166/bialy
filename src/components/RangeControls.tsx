import { useState, useEffect } from 'react';

export type RangePreset = 'QTD' | 'YTD' | 'all' | 'custom';

export interface DateRange {
  preset: RangePreset;
  startDate?: Date;
  endDate?: Date;
}

interface RangeControlsProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  dataExtent?: [Date, Date];
}

export function RangeControls({ range, onChange, dataExtent }: RangeControlsProps) {
  const [localStartDate, setLocalStartDate] = useState(
    range.startDate ? range.startDate.toISOString().split('T')[0] : ''
  );
  const [localEndDate, setLocalEndDate] = useState(
    range.endDate ? range.endDate.toISOString().split('T')[0] : ''
  );

  // 🔧 FIX: Sync internal state when range prop changes (e.g., when switching dashboards)
  useEffect(() => {
    setLocalStartDate(range.startDate ? range.startDate.toISOString().split('T')[0] : '');
    setLocalEndDate(range.endDate ? range.endDate.toISOString().split('T')[0] : '');
  }, [range.startDate, range.endDate]);

  const getEndOfQuarter = (date: Date): Date => {
    const quarter = Math.floor(date.getMonth() / 3);
    const endOfQuarter = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
    endOfQuarter.setHours(23, 59, 59, 999);
    return endOfQuarter;
  };

  const handlePresetChange = (preset: RangePreset) => {
    if (preset === 'custom') {
      onChange({
        preset: 'custom',
        startDate: range.startDate,
        endDate: range.endDate
      });
    } else if (preset === 'all') {
      // All Data - use data extent if available
      const startDate = dataExtent ? dataExtent[0] : undefined;
      const endDate = dataExtent ? dataExtent[1] : undefined;

      // Update local state
      setLocalStartDate(startDate ? startDate.toISOString().split('T')[0] : '');
      setLocalEndDate(endDate ? endDate.toISOString().split('T')[0] : '');

      onChange({
        preset: 'all',
        startDate,
        endDate
      });
    } else {
      // Calculate date ranges based on preset
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      let startDate: Date;
      let endDate: Date;

      switch (preset) {
        case 'QTD': {
          // Quarter to Date - start of current quarter
          const quarter = Math.floor(today.getMonth() / 3);
          startDate = new Date(today.getFullYear(), quarter * 3, 1);
          // Extend to end of current quarter
          endDate = getEndOfQuarter(today);
          break;
        }
        case 'YTD': {
          // Year to Date - start of current year
          startDate = new Date(today.getFullYear(), 0, 1);
          // Extend to end of quarter containing today
          endDate = getEndOfQuarter(today);
          break;
        }
        default:
          startDate = today;
          endDate = getEndOfQuarter(today);
      }

      startDate.setHours(0, 0, 0, 0);

      // Update local state
      setLocalStartDate(startDate.toISOString().split('T')[0]);
      setLocalEndDate(endDate.toISOString().split('T')[0]);

      onChange({
        preset,
        startDate,
        endDate
      });
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (!value) return;

    const date = new Date(value);

    if (type === 'start') {
      setLocalStartDate(value);
      date.setHours(0, 0, 0, 0);
      onChange({
        preset: 'custom',
        startDate: date,
        endDate: range.endDate
      });
    } else {
      setLocalEndDate(value);
      // Extend end date to end of quarter
      const endDate = getEndOfQuarter(date);
      onChange({
        preset: 'custom',
        startDate: range.startDate,
        endDate: endDate
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Preset Selection */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Range Preset
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePresetChange('QTD')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              range.preset === 'QTD'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current Quarter
          </button>
          <button
            onClick={() => handlePresetChange('YTD')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              range.preset === 'YTD'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current Year
          </button>
          <button
            onClick={() => handlePresetChange('all')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              range.preset === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Data
          </button>
          <button
            onClick={() => handlePresetChange('custom')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              range.preset === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Date Range - Always Visible */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={localStartDate}
            onChange={(e) => handleCustomDateChange('start', e.target.value)}
            min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
            max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={localEndDate}
            onChange={(e) => handleCustomDateChange('end', e.target.value)}
            min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
            max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
          />
        </div>
      </div>
    </div>
  );
}
