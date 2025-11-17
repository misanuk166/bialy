import { useState } from 'react';
import type { FocusPeriod } from '../types/focusPeriod';

interface FocusPeriodModalProps {
  focusPeriod: FocusPeriod;
  dataExtent?: [Date, Date];
  onSave: (focusPeriod: FocusPeriod) => void;
  onClose: () => void;
}

export function FocusPeriodModal({
  focusPeriod,
  dataExtent,
  onSave,
  onClose
}: FocusPeriodModalProps) {
  const [enabled, setEnabled] = useState(focusPeriod.enabled);
  const [label, setLabel] = useState(focusPeriod.label || '');
  const [startDate, setStartDate] = useState(
    focusPeriod.startDate ? focusPeriod.startDate.toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    focusPeriod.endDate ? focusPeriod.endDate.toISOString().split('T')[0] : ''
  );

  const handleSave = () => {
    onSave({
      enabled,
      label: label.trim() || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Edit Focus Period</h2>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="font-medium">Enable Focus Period</span>
            </label>
          </div>

          {enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Q4 2024"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
                  max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || (dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined)}
                  max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
