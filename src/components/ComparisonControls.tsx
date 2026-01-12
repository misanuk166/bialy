import { useState, useEffect } from 'react';
import type { ComparisonConfig, ComparisonType, ComparisonPeriodType } from '../types/comparison';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import type { FocusPeriod } from '../types/focusPeriod';
import { generateShadowPeriodLabel } from '../utils/shadowLabels';

interface ComparisonControlsProps {
  comparisons: ComparisonConfig[];
  shadows?: Shadow[];
  goals?: Goal[];
  onChange: (comparisons: ComparisonConfig[]) => void;
  filterPeriodType?: 'selection' | 'focus';
  includesForecast?: boolean;
  onIncludesForecastChange?: (includesForecast: boolean) => void;
  focusPeriod?: FocusPeriod;
  onFocusPeriodChange?: (focusPeriod: FocusPeriod) => void;
  dataExtent?: [Date, Date];
}

export function ComparisonControls({
  comparisons,
  shadows,
  goals,
  onChange,
  filterPeriodType,
  includesForecast = false,
  onIncludesForecastChange,
  focusPeriod,
  onFocusPeriodChange,
  dataExtent
}: ComparisonControlsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state for add/edit
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<ComparisonType>('shadow');
  const [formPeriodType, setFormPeriodType] = useState<ComparisonPeriodType>(filterPeriodType || 'selection');
  const [formTargetIndex, setFormTargetIndex] = useState<number | undefined>(undefined);

  // Focus period form state
  const calculateCurrentQuarter = (date: Date): { label: string; startDate: Date; endDate: Date } => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const quarter = Math.floor(month / 3) + 1;

    const quarterStartMonth = (quarter - 1) * 3;
    const quarterEndMonth = quarterStartMonth + 2;

    const startDate = new Date(year, quarterStartMonth, 1);
    const endDate = new Date(year, quarterEndMonth + 1, 0);

    return {
      label: `${year} Q${quarter}`,
      startDate,
      endDate
    };
  };

  const [focusLabel, setFocusLabel] = useState(() => {
    if (focusPeriod?.label) return focusPeriod.label;
    if (dataExtent && dataExtent[1]) {
      const quarter = calculateCurrentQuarter(dataExtent[1]);
      return quarter.label;
    }
    return '';
  });

  const [focusStartDate, setFocusStartDate] = useState(() => {
    if (focusPeriod?.startDate) return focusPeriod.startDate.toISOString().split('T')[0];
    if (dataExtent && dataExtent[1]) {
      const quarter = calculateCurrentQuarter(dataExtent[1]);
      return quarter.startDate.toISOString().split('T')[0];
    }
    return '';
  });

  const [focusEndDate, setFocusEndDate] = useState(() => {
    if (focusPeriod?.endDate) return focusPeriod.endDate.toISOString().split('T')[0];
    if (dataExtent && dataExtent[1]) {
      const quarter = calculateCurrentQuarter(dataExtent[1]);
      return quarter.endDate.toISOString().split('T')[0];
    }
    return '';
  });

  // 🔧 FIX: Sync internal state when focusPeriod prop changes (e.g., when switching dashboards)
  useEffect(() => {
    if (focusPeriod?.label !== undefined) {
      setFocusLabel(focusPeriod.label || '');
    }
    if (focusPeriod?.startDate !== undefined) {
      setFocusStartDate(focusPeriod.startDate ? focusPeriod.startDate.toISOString().split('T')[0] : '');
    }
    if (focusPeriod?.endDate !== undefined) {
      setFocusEndDate(focusPeriod.endDate ? focusPeriod.endDate.toISOString().split('T')[0] : '');
    }
  }, [focusPeriod]);

  const resetForm = () => {
    setFormLabel('');
    setFormType('shadow');
    setFormPeriodType(filterPeriodType || 'selection');
    setFormTargetIndex(undefined);
    setEditingId(null);
    setShowAddForm(false);
  };

  const generateLabel = (type: ComparisonType, targetIndex?: number): string => {
    switch (type) {
      case 'shadow': {
        if (targetIndex !== undefined && shadows && targetIndex < shadows.length) {
          const shadow = shadows.filter(s => s.enabled)[targetIndex];
          return shadow ? generateShadowPeriodLabel(shadow) : `vs ${type}`;
        }
        // Default to first enabled shadow if no specific index
        const firstShadow = shadows?.find(s => s.enabled);
        return firstShadow ? generateShadowPeriodLabel(firstShadow) : 'vs Shadow';
      }
      case 'goal': {
        const enabledGoals = goals?.filter(g => g.enabled) || [];
        // Only add number if there are multiple goals
        if (enabledGoals.length > 1 && targetIndex !== undefined) {
          return `vs Goal ${targetIndex + 1}`;
        }
        return 'vs Goal';
      }
      case 'forecast':
        return 'vs Forecast';
      default:
        return `vs ${type}`;
    }
  };

  const handleAdd = () => {
    const maxOrder = comparisons.length > 0 ? Math.max(...comparisons.map(c => c.order)) : -1;
    const autoLabel = generateLabel(formType, formTargetIndex);
    const newComparison: ComparisonConfig = {
      id: `comparison-${Date.now()}`,
      label: formLabel.trim() || autoLabel,
      type: formType,
      periodType: formPeriodType,
      targetIndex: formTargetIndex,
      order: maxOrder + 1,
      enabled: true
    };
    onChange([...comparisons, newComparison]);
    resetForm();
  };

  const handleEdit = (comparison: ComparisonConfig) => {
    setEditingId(comparison.id);
    setFormLabel(comparison.label);
    setFormType(comparison.type);
    setFormPeriodType(comparison.periodType);
    setFormTargetIndex(comparison.targetIndex);
    setShowAddForm(true);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const autoLabel = generateLabel(formType, formTargetIndex);
    const updated = comparisons.map(c =>
      c.id === editingId
        ? { ...c, label: formLabel.trim() || autoLabel, type: formType, periodType: formPeriodType, targetIndex: formTargetIndex }
        : c
    );
    onChange(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    onChange(comparisons.filter(c => c.id !== id));
  };

  const handleToggleEnabled = (id: string) => {
    const updated = comparisons.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    onChange(updated);
  };

  const handleMoveUp = (id: string) => {
    const index = comparisons.findIndex(c => c.id === id);
    if (index <= 0) return;

    const newComparisons = [...comparisons];
    [newComparisons[index - 1], newComparisons[index]] = [newComparisons[index], newComparisons[index - 1]];

    // Update order values
    const reordered = newComparisons.map((c, i) => ({ ...c, order: i }));
    onChange(reordered);
  };

  const handleMoveDown = (id: string) => {
    const index = comparisons.findIndex(c => c.id === id);
    if (index < 0 || index >= comparisons.length - 1) return;

    const newComparisons = [...comparisons];
    [newComparisons[index], newComparisons[index + 1]] = [newComparisons[index + 1], newComparisons[index]];

    // Update order values
    const reordered = newComparisons.map((c, i) => ({ ...c, order: i }));
    onChange(reordered);
  };

  const handleApplyFocusPeriod = () => {
    if (!onFocusPeriodChange) return;
    const hasData = !!(focusStartDate && focusEndDate);
    onFocusPeriodChange({
      enabled: hasData,
      label: focusLabel.trim() || undefined,
      startDate: focusStartDate ? new Date(focusStartDate) : undefined,
      endDate: focusEndDate ? new Date(focusEndDate) : undefined
    });
  };

  const handleClearFocusPeriod = () => {
    if (!onFocusPeriodChange) return;
    onFocusPeriodChange({ enabled: false });
    setFocusLabel('');
    setFocusStartDate('');
    setFocusEndDate('');
  };

  // Sort comparisons by order for display
  const sortedComparisons = [...comparisons].sort((a, b) => a.order - b.order);

  // Filter by period type if specified
  const filteredComparisons = filterPeriodType
    ? sortedComparisons.filter(c => c.periodType === filterPeriodType)
    : sortedComparisons;

  // Group by period type (only used when not filtering)
  const selectionComparisons = filteredComparisons.filter(c => c.periodType === 'selection');
  const focusComparisons = filteredComparisons.filter(c => c.periodType === 'focus');

  // Get available targets based on type
  const getAvailableTargets = (type: ComparisonType): Array<{ index: number; label: string }> => {
    switch (type) {
      case 'shadow':
        return shadows?.filter(s => s.enabled).map((s, i) => ({ index: i, label: s.label })) || [];
      case 'goal':
        return goals?.filter(g => g.enabled).map((g, i) => ({ index: i, label: g.label })) || [];
      case 'forecast':
        return [{ index: 0, label: 'Forecast' }];
      default:
        return [];
    }
  };

  const availableTargets = getAvailableTargets(formType);

  const renderComparisonList = (comps: ComparisonConfig[], periodLabel: string) => {
    if (comps.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">{periodLabel} Comparisons</h4>
        <div className="space-y-2">
          {comps.map((comp, idx) => (
            <div key={comp.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
              <input
                type="checkbox"
                checked={comp.enabled}
                onChange={() => handleToggleEnabled(comp.id)}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{comp.label}</div>
                <div className="text-xs text-gray-600">
                  Type: {comp.type}
                  {comp.targetIndex !== undefined && ` (${getAvailableTargets(comp.type)[comp.targetIndex]?.label || 'N/A'})`}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleMoveUp(comp.id)}
                  disabled={idx === 0}
                  className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMoveDown(comp.id)}
                  disabled={idx === comps.length - 1}
                  className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleEdit(comp)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(comp.id)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Focus Period Date Inputs (only show when filterPeriodType is 'focus') */}
      {filterPeriodType === 'focus' && onFocusPeriodChange && (
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Focus Period Settings</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Label (optional)
              </label>
              <input
                type="text"
                value={focusLabel}
                onChange={(e) => setFocusLabel(e.target.value)}
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
                value={focusStartDate}
                onChange={(e) => setFocusStartDate(e.target.value)}
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
                value={focusEndDate}
                onChange={(e) => setFocusEndDate(e.target.value)}
                min={focusStartDate || (dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined)}
                max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleClearFocusPeriod}
                className="flex-1 text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Clear
              </button>
              <button
                onClick={handleApplyFocusPeriod}
                disabled={!focusStartDate || !focusEndDate}
                className="flex-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Include Forecast Checkbox */}
      {onIncludesForecastChange && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border border-gray-200">
          <input
            type="checkbox"
            id="includesForecast"
            checked={includesForecast}
            onChange={(e) => onIncludesForecastChange(e.target.checked)}
            className="flex-shrink-0"
          />
          <label htmlFor="includesForecast" className="text-sm text-gray-700 cursor-pointer">
            <span className="font-medium">Include Forecast in {filterPeriodType === 'selection' ? 'Selection' : 'Focus Period'}</span>
            <p className="text-xs text-gray-600 mt-0.5">
              When enabled, uses forecast data to extend the primary series (does not affect comparison targets)
            </p>
          </label>
        </div>
      )}

      {/* Comparison Lists */}
      {(!filterPeriodType || filterPeriodType === 'selection') && renderComparisonList(selectionComparisons, 'Selection')}
      {(!filterPeriodType || filterPeriodType === 'focus') && renderComparisonList(focusComparisons, 'Focus Period')}

      {/* Add/Edit Form */}
      {showAddForm ? (
        <div className="border border-blue-500 rounded p-4 bg-blue-50">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            {editingId ? 'Edit Comparison' : 'Add Comparison'}
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Label (optional)</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={generateLabel(formType, formTargetIndex)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to auto-generate</p>
            </div>

            {!filterPeriodType && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Period Type</label>
                <select
                  value={formPeriodType}
                  onChange={(e) => setFormPeriodType(e.target.value as ComparisonPeriodType)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  <option value="selection">Selection</option>
                  <option value="focus">Focus Period</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Compare To</label>
              <select
                value={formType}
                onChange={(e) => {
                  setFormType(e.target.value as ComparisonType);
                  setFormTargetIndex(undefined); // Reset target when type changes
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="shadow">Shadow</option>
                <option value="goal">Goal</option>
                <option value="forecast">Forecast</option>
              </select>
            </div>

            {availableTargets.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Which {formType}?
                </label>
                <select
                  value={formTargetIndex ?? ''}
                  onChange={(e) => setFormTargetIndex(e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  <option value="">Auto (first available)</option>
                  {availableTargets.map((target) => (
                    <option key={target.index} value={target.index}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={editingId ? handleSaveEdit : handleAdd}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingId ? 'Save Changes' : 'Add Comparison'}
              </button>
              <button
                onClick={resetForm}
                className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Add Comparison
        </button>
      )}
    </div>
  );
}
