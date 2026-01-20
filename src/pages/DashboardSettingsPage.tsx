import { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { fetchDashboards } from '../services/dashboardService';
import {
  fetchDashboardSettings,
  saveBatchSettings,
  deleteAllDashboardSettings,
  type SettingValue
} from '../services/settingsService';
import type { Dashboard } from '../types/dashboard';

// Setting types
interface SettingConfig {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'select' | 'number' | 'color';
  options?: { value: string; label: string }[];
}

interface SettingState {
  globalValue: any;
  dashboardOverrides: Map<string, any>;
}

// Settings configuration
const SETTINGS: Record<string, { section: string; settings: SettingConfig[] }> = {
  formatting: {
    section: 'Number Formatting',
    settings: [
      {
        id: 'decimalPlaces',
        label: 'Decimal Places',
        description: 'Number of decimal places to display for metric values',
        type: 'select',
        options: [
          { value: '0', label: '0 (whole numbers)' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
      },
    ],
  },
  chart: {
    section: 'Chart Appearance',
    settings: [
      {
        id: 'seriesColor',
        label: 'Series Line Color',
        description: 'Color for the main metric line in charts',
        type: 'color',
      },
      // NOTE: dateRange was removed - it's part of dashboard working state, not a preference
    ],
  },
};

// Default values
const DEFAULT_SETTINGS: Record<string, any> = {
  decimalPlaces: '2',
  seriesColor: '#2563eb',
};

export function DashboardSettingsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [settings, setSettings] = useState<Map<string, SettingState>>(new Map());
  const [overrideStates, setOverrideStates] = useState<Map<string, Set<string>>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTip, setShowTip] = useState(() => {
    // Load from localStorage, default to true if not set
    const saved = localStorage.getItem('dashboardSettings.showTip');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    loadDashboards();
    loadSettings();
  }, []);

  const loadDashboards = async () => {
    try {
      const data = await fetchDashboards();
      setDashboards(data);
      if (data.length > 0 && !selectedDashboard) {
        setSelectedDashboard(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load dashboards:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDashboardSettings();

      // Initialize settings map with defaults
      const loadedSettings = new Map<string, SettingState>();
      const loadedOverrides = new Map<string, Set<string>>();

      Object.values(SETTINGS).forEach(({ settings: settingList }) => {
        settingList.forEach((setting) => {
          // Get global value from API or use default
          const globalValue = data.globalSettings.get(setting.id) ?? DEFAULT_SETTINGS[setting.id];

          // Get dashboard overrides from API
          const dashboardOverrides = new Map<string, any>();
          data.dashboardSettings.forEach((settingsMap, dashboardId) => {
            const value = settingsMap.get(setting.id);
            if (value !== undefined) {
              dashboardOverrides.set(dashboardId, value);
            }
          });

          loadedSettings.set(setting.id, {
            globalValue,
            dashboardOverrides,
          });
        });
      });

      // Build override states (which settings have dashboard-specific overrides)
      data.dashboardSettings.forEach((settingsMap, dashboardId) => {
        const overrideSet = new Set<string>();
        settingsMap.forEach((_, settingId) => {
          overrideSet.add(settingId);
        });
        loadedOverrides.set(dashboardId, overrideSet);
      });

      setSettings(loadedSettings);
      setOverrideStates(loadedOverrides);
    } catch (error) {
      console.error('Failed to load settings:', error);
      alert('Failed to load settings. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSettingValue = (settingId: string): any => {
    const setting = settings.get(settingId);
    if (!setting) return DEFAULT_SETTINGS[settingId];

    if (selectedDashboard && setting.dashboardOverrides.has(selectedDashboard)) {
      return setting.dashboardOverrides.get(selectedDashboard);
    }
    return setting.globalValue;
  };

  const isOverridden = (settingId: string): boolean => {
    if (!selectedDashboard) return false;
    const overrides = overrideStates.get(selectedDashboard);
    return overrides?.has(settingId) || false;
  };

  const handleGlobalChange = (settingId: string, value: any) => {
    setSettings((prev) => {
      const newSettings = new Map(prev);
      const setting = newSettings.get(settingId);
      if (setting) {
        newSettings.set(settingId, {
          ...setting,
          globalValue: value,
        });
      }
      return newSettings;
    });
    setHasChanges(true);
  };

  const handleDashboardChange = (settingId: string, value: any) => {
    if (!selectedDashboard) return;

    // Auto-enable override when value is changed
    setOverrideStates((prev) => {
      const newStates = new Map(prev);
      const dashboardOverrides = newStates.get(selectedDashboard) || new Set();
      const newDashboardOverrides = new Set(dashboardOverrides);
      newDashboardOverrides.add(settingId);
      newStates.set(selectedDashboard, newDashboardOverrides);
      return newStates;
    });

    setSettings((prev) => {
      const newSettings = new Map(prev);
      const setting = newSettings.get(settingId);
      if (setting) {
        const newOverrides = new Map(setting.dashboardOverrides);
        newOverrides.set(selectedDashboard, value);
        newSettings.set(settingId, {
          ...setting,
          dashboardOverrides: newOverrides,
        });
      }
      return newSettings;
    });
    setHasChanges(true);
  };

  const handleToggleOverride = (settingId: string) => {
    if (!selectedDashboard) return;

    setOverrideStates((prev) => {
      const newStates = new Map(prev);
      const dashboardOverrides = newStates.get(selectedDashboard) || new Set();
      const newDashboardOverrides = new Set(dashboardOverrides);

      if (newDashboardOverrides.has(settingId)) {
        // Unchecking - remove the override value
        newDashboardOverrides.delete(settingId);
        setSettings((prevSettings) => {
          const newSettings = new Map(prevSettings);
          const setting = newSettings.get(settingId);
          if (setting) {
            const newOverrides = new Map(setting.dashboardOverrides);
            newOverrides.delete(selectedDashboard);
            newSettings.set(settingId, {
              ...setting,
              dashboardOverrides: newOverrides,
            });
          }
          return newSettings;
        });
      } else {
        // Checking - add override with current global value as starting point
        newDashboardOverrides.add(settingId);
        setSettings((prevSettings) => {
          const newSettings = new Map(prevSettings);
          const setting = newSettings.get(settingId);
          if (setting) {
            const newOverrides = new Map(setting.dashboardOverrides);
            // Initialize with global value if not already set
            if (!newOverrides.has(selectedDashboard)) {
              newOverrides.set(selectedDashboard, setting.globalValue);
            }
            newSettings.set(settingId, {
              ...setting,
              dashboardOverrides: newOverrides,
            });
          }
          return newSettings;
        });
      }

      newStates.set(selectedDashboard, newDashboardOverrides);
      return newStates;
    });
    setHasChanges(true);
  };

  const handleResetAllOverrides = async () => {
    if (!selectedDashboard) return;

    const confirmed = confirm('Reset all dashboard-specific overrides to global defaults?');
    if (!confirmed) return;

    try {
      // Delete all settings for this dashboard from the database
      await deleteAllDashboardSettings(selectedDashboard);

      // Update local state
      setOverrideStates((prev) => {
        const newStates = new Map(prev);
        newStates.delete(selectedDashboard);
        return newStates;
      });

      setSettings((prev) => {
        const newSettings = new Map(prev);
        newSettings.forEach((setting, key) => {
          const newOverrides = new Map(setting.dashboardOverrides);
          newOverrides.delete(selectedDashboard);
          newSettings.set(key, {
            ...setting,
            dashboardOverrides: newOverrides,
          });
        });
        return newSettings;
      });

      alert('All overrides have been reset to global defaults.');
    } catch (error) {
      console.error('Failed to reset overrides:', error);
      alert('Failed to reset overrides. Please try again.');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Build batch of settings to save
      const settingsToSave: Array<{
        dashboardId: string | null;
        settingId: string;
        value: SettingValue;
      }> = [];

      // Add global settings
      settings.forEach((setting, settingId) => {
        settingsToSave.push({
          dashboardId: null,
          settingId,
          value: setting.globalValue
        });
      });

      // Add dashboard-specific overrides
      settings.forEach((setting, settingId) => {
        setting.dashboardOverrides.forEach((value, dashboardId) => {
          settingsToSave.push({
            dashboardId,
            settingId,
            value
          });
        });
      });

      // Save to database
      await saveBatchSettings(settingsToSave);

      setHasChanges(false);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismissTip = () => {
    setShowTip(false);
    localStorage.setItem('dashboardSettings.showTip', 'false');
  };

  const renderControl = (
    setting: SettingConfig,
    value: any,
    onChange: (value: any) => void,
    disabled: boolean
  ) => {
    switch (setting.type) {
      case 'toggle':
        return (
          <label className="relative inline-block w-12 h-7">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="sr-only"
            />
            <span
              className={`block w-12 h-7 rounded-full transition-colors cursor-pointer ${
                disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : value
                  ? 'bg-green-500'
                  : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  value ? 'transform translate-x-5' : ''
                }`}
              />
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`px-3 py-2 border rounded-lg text-sm min-w-[160px] ${
              disabled
                ? 'opacity-40 cursor-not-allowed bg-gray-50'
                : 'bg-white border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            } ${!disabled && isOverridden(setting.id) ? 'border-orange-500 border-2' : ''}`}
          >
            {setting.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            disabled={disabled}
            className={`px-3 py-2 border rounded-lg text-sm w-24 text-center ${
              disabled
                ? 'opacity-40 cursor-not-allowed bg-gray-50'
                : 'bg-white border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            } ${!disabled && isOverridden(setting.id) ? 'border-orange-500 border-2' : ''}`}
          />
        );

      case 'color':
        return (
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-14 h-10 border rounded-lg cursor-pointer ${
              disabled ? 'opacity-40 cursor-not-allowed' : 'border-gray-300 hover:border-gray-400'
            } ${!disabled && isOverridden(setting.id) ? 'border-orange-500 border-2' : ''}`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Sidebar currentDashboardId={null} onShareDashboard={() => {}} />

      <div className="ml-64 min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure global defaults and customize individual dashboard preferences
          </p>
        </div>

        {/* Content Body */}
        <div className="px-8 py-6">
          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-3 text-gray-600">Loading settings...</span>
            </div>
          ) : (
            <>
              {/* Info Banner */}
              {showTip && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg relative">
              <p className="text-sm text-gray-700 pr-8">
                <strong className="font-semibold">Tip:</strong> Check the box next to a setting to
                override global defaults for the selected dashboard.
              </p>
              <button
                onClick={handleDismissTip}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Dismiss tip"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Settings Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1fr_1.2fr] gap-6 px-8 py-5 bg-gray-50 border-b-2 border-gray-200">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Setting
              </div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                Global Default
              </div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                <select
                  value={selectedDashboard || ''}
                  onChange={(e) => setSelectedDashboard(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {dashboards.map((dashboard) => (
                    <option key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Settings Sections */}
            {Object.entries(SETTINGS).map(([sectionKey, { section, settings: settingList }]) => (
              <div key={sectionKey}>
                {/* Section Header */}
                <div className="bg-gray-50 px-8 py-3 border-t border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">{section}</h3>
                </div>

                {/* Settings Rows */}
                {settingList.map((setting) => {
                  const globalValue = settings.get(setting.id)?.globalValue;
                  const dashboardValue = getSettingValue(setting.id);
                  const isOverriden = isOverridden(setting.id);

                  return (
                    <div
                      key={setting.id}
                      className="grid grid-cols-[2fr_1fr_1.2fr] gap-6 px-8 py-5 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {/* Setting Info */}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{setting.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{setting.description}</div>
                      </div>

                      {/* Global Value */}
                      <div className="flex items-center justify-center">
                        {renderControl(setting, globalValue, (value) => handleGlobalChange(setting.id, value), false)}
                      </div>

                      {/* Dashboard Value */}
                      <div
                        className={`flex flex-col items-center justify-center gap-2 ${
                          isOverriden ? 'bg-orange-50 -mx-6 px-6 -my-5 py-5 rounded-lg' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {renderControl(
                            setting,
                            dashboardValue,
                            (value) => handleDashboardChange(setting.id, value),
                            false
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                          <input
                            type="checkbox"
                            checked={isOverriden}
                            onChange={() => handleToggleOverride(setting.id)}
                            className="w-3.5 h-3.5 accent-orange-500"
                          />
                          <span
                            className={`${
                              isOverriden ? 'text-orange-600 font-semibold' : 'text-gray-600'
                            }`}
                          >
                            {isOverriden && (
                              <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5"></span>
                            )}
                            {isOverriden ? 'Override Active' : 'Override'}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={handleResetAllOverrides}
              disabled={!selectedDashboard}
              className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset All Overrides
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
