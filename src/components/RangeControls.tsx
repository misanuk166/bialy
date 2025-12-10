import { useState } from 'react';

export type RangePreset = 'QTD' | 'YTD' | '12M' | 'custom';

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

  const handlePresetChange = (preset: RangePreset) => {
    if (preset === 'custom') {
      onChange({
        preset: 'custom',
        startDate: range.startDate,
        endDate: range.endDate
      });
    } else {
      // Calculate date ranges based on preset
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      let startDate: Date;
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999); // End of today

      switch (preset) {
        case 'QTD': {
          // Quarter to Date - start of current quarter
          const quarter = Math.floor(today.getMonth() / 3);
          startDate = new Date(today.getFullYear(), quarter * 3, 1);
          break;
        }
        case 'YTD': {
          // Year to Date - start of current year
          startDate = new Date(today.getFullYear(), 0, 1);
          break;
        }
        case '12M': {
          // Last 12 months
          startDate = new Date(today);
          startDate.setMonth(startDate.getMonth() - 12);
          break;
        }
        default:
          startDate = today;
      }

      startDate.setHours(0, 0, 0, 0);

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
      onChange({
        preset: 'custom',
        startDate: date,
        endDate: range.endDate
      });
    } else {
      setLocalEndDate(value);
      onChange({
        preset: 'custom',
        startDate: range.startDate,
        endDate: date
      });
    }
  };

  const getDateRangeLabel = () => {
    if (range.preset !== 'custom') {
      return range.preset;
    }
    if (range.startDate && range.endDate) {
      return `${range.startDate.toLocaleDateString()} - ${range.endDate.toLocaleDateString()}`;
    }
    return 'Custom Range';
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Select a time range for data analysis
      </p>

      {/* Preset Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Range Preset
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePresetChange('QTD')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              range.preset === 'QTD'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current Quarter
          </button>
          <button
            onClick={() => handlePresetChange('YTD')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              range.preset === 'YTD'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current Year
          </button>
          <button
            onClick={() => handlePresetChange('12M')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              range.preset === '12M'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            12 Months
          </button>
          <button
            onClick={() => handlePresetChange('custom')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              range.preset === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      {range.preset === 'custom' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => handleCustomDateChange('start', e.target.value)}
              min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
              max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => handleCustomDateChange('end', e.target.value)}
              min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
              max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Current Range Display */}
      <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
        Range: <span className="font-semibold">{getDateRangeLabel()}</span>
      </div>
    </div>
  );
}
