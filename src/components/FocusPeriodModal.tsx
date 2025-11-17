import { useState, useEffect, useRef } from 'react';
import type { FocusPeriod } from '../types/focusPeriod';

interface FocusPeriodModalProps {
  focusPeriod: FocusPeriod;
  dataExtent?: [Date, Date];
  onSave: (focusPeriod: FocusPeriod) => void;
  onClose: () => void;
  anchorElement?: HTMLElement;
}

export function FocusPeriodModal({
  focusPeriod,
  dataExtent,
  onSave,
  onClose,
  anchorElement
}: FocusPeriodModalProps) {
  const [label, setLabel] = useState(focusPeriod.label || '');
  const [startDate, setStartDate] = useState(
    focusPeriod.startDate ? focusPeriod.startDate.toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    focusPeriod.endDate ? focusPeriod.endDate.toISOString().split('T')[0] : ''
  );
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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
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
      className="absolute bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
      style={{
        top: anchorElement ? anchorElement.offsetTop + anchorElement.offsetHeight + 5 : '50%',
        left: anchorElement ? anchorElement.offsetLeft : '50%',
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
            max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || (dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined)}
            max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          />
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
