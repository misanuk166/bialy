import { useState, useEffect, useRef } from 'react';

interface SelectionPeriodModalProps {
  selectionDate: Date;
  includesForecast?: boolean;
  dataExtent?: [Date, Date];
  onSelectionDateChange: (date: Date) => void;
  onIncludesForecastChange?: (includesForecast: boolean) => void;
  onClose: () => void;
  anchorElement?: HTMLElement;
}

export function SelectionPeriodModal({
  selectionDate,
  includesForecast = false,
  dataExtent,
  onSelectionDateChange,
  onIncludesForecastChange,
  onClose,
  anchorElement
}: SelectionPeriodModalProps) {
  const [dateValue, setDateValue] = useState(selectionDate.toISOString().split('T')[0]);
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
    if (dateValue) {
      onSelectionDateChange(new Date(dateValue));
    }
    onClose();
  };

  return (
    <div
      ref={popupRef}
      className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
      style={{
        top: anchorElement ? anchorElement.getBoundingClientRect().bottom + 5 : '50%',
        left: anchorElement ? anchorElement.getBoundingClientRect().left : '50%',
        width: '280px'
      }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Selection Date
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
            max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
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
          onClick={onClose}
          className="flex-1 text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!dateValue}
          className="flex-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
