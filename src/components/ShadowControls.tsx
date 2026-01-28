import React from 'react';
import type { Shadow, ShadowPeriodUnit } from '../types/shadow';
import { createShadow } from '../utils/shadows';

interface ShadowControlsProps {
  shadows: Shadow[];
  onChange: (shadows: Shadow[]) => void;
  maxShadows?: number;
  averageTogether?: boolean;
  onAverageTogetherChange?: (enabled: boolean) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function ShadowControls({
  shadows,
  onChange,
  maxShadows = 10,
  averageTogether = false,
  onAverageTogetherChange,
  enabled,
  onEnabledChange
}: ShadowControlsProps) {
  const [period, setPeriod] = React.useState(1);
  const [unit, setUnit] = React.useState<ShadowPeriodUnit>('year');
  const [count, setCount] = React.useState(1);

  const generateShadows = (p: number, u: ShadowPeriodUnit, c: number) => {
    // Preserve the current alignDayOfWeek setting
    const currentAlignDayOfWeek = shadows.length > 0 ? shadows[0].alignDayOfWeek : false;

    const newShadows: Shadow[] = [];
    for (let i = 1; i <= c; i++) {
      const totalPeriods = p * i;
      const label = `${totalPeriods} ${u}${totalPeriods > 1 ? 's' : ''} ago`;
      const shadow = createShadow(totalPeriods, u, label);
      // Apply the preserved alignDayOfWeek setting
      shadow.alignDayOfWeek = currentAlignDayOfWeek;
      newShadows.push(shadow);
    }
    onChange(newShadows);
  };

  // 🔧 FIX: Sync internal state when shadows prop changes (e.g., when switching dashboards)
  // Initialize from existing shadows or generate initial shadows
  React.useEffect(() => {
    if (shadows.length > 0) {
      setCount(shadows.length);
      // Try to infer period and unit from first shadow
      const firstShadow = shadows[0];
      if (firstShadow) {
        setPeriod(firstShadow.periods);
        setUnit(firstShadow.unit);
      }
    }
  }, [shadows]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPeriod = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
    setPeriod(newPeriod);
    generateShadows(newPeriod, unit, count);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as ShadowPeriodUnit;
    setUnit(newUnit);
    generateShadows(period, newUnit, count);
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = Math.max(1, Math.min(maxShadows, parseInt(e.target.value) || 1));
    setCount(newCount);
    generateShadows(period, unit, newCount);
  };

  const handleToggle = () => {
    onEnabledChange(!enabled);
  };

  const handleAlignDayOfWeekChange = (alignEnabled: boolean) => {
    const updatedShadows = shadows.map(shadow => ({
      ...shadow,
      alignDayOfWeek: alignEnabled
    }));
    onChange(updatedShadows);
  };

  // Check if any shadows have alignDayOfWeek enabled
  const alignDayOfWeekEnabled = shadows.length > 0 && shadows[0].alignDayOfWeek === true;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">
          Enable Shadows
        </label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="h-px bg-gray-200"></div>

      <div className={`space-y-2 relative transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {!enabled && (
          <div className="absolute inset-0 bg-white/60 rounded z-10"></div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Period
          </label>
          <input
            type="number"
            min="1"
            max="99"
            value={period}
            onChange={handlePeriodChange}
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Time Unit
          </label>
          <select
            value={unit}
            onChange={handleUnitChange}
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
          >
            <option value="day">Days</option>
            <option value="week">Weeks</option>
            <option value="month">Months</option>
            <option value="quarter">Quarters</option>
            <option value="year">Years</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Number of Shadows
          </label>
          <input
            type="number"
            min="1"
            max={maxShadows}
            value={count}
            onChange={handleCountChange}
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
          />
        </div>

        {count > 1 && onAverageTogetherChange && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-200">
            <label className="text-xs font-medium text-gray-700">
              Average together
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={averageTogether}
                onChange={(e) => onAverageTogetherChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-gray-200">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700">
              Align day-of-week
            </label>
            <span className="text-[10px] text-gray-500">
              Shift by up to 3 days to match weekday
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={alignDayOfWeekEnabled}
              onChange={(e) => handleAlignDayOfWeekChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
