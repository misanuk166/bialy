import type { GlobalSettings } from '../types/appState';
import type { SettingValue } from '../services/settingsService';

/**
 * Apply dashboard settings to global settings
 * This function takes the loaded dashboard settings and applies them to override
 * the default global settings for things like date range, aggregation, visibility, etc.
 */
export function applyDashboardSettings(
  baseSettings: GlobalSettings,
  dashboardSettings: Map<string, SettingValue>
): GlobalSettings {
  const updatedSettings = { ...baseSettings };

  // Apply date range setting
  const dateRange = dashboardSettings.get('dateRange') as string | undefined;
  if (dateRange) {
    switch (dateRange) {
      case 'all':
        updatedSettings.dateRange = { preset: 'all' };
        break;
      case 'qtd':
        updatedSettings.dateRange = { preset: 'qtd' };
        break;
      case 'ytd':
        updatedSettings.dateRange = { preset: 'ytd' };
        break;
      case '30d':
        updatedSettings.dateRange = { preset: 'last30days' };
        break;
      case '90d':
        updatedSettings.dateRange = { preset: 'last90days' };
        break;
    }
  }

  return updatedSettings;
}

/**
 * Get the decimal places setting for formatting numbers
 */
export function getDecimalPlaces(dashboardSettings: Map<string, SettingValue>): number {
  const decimalPlaces = dashboardSettings.get('decimalPlaces');
  if (typeof decimalPlaces === 'string') {
    return parseInt(decimalPlaces, 10);
  }
  return 2; // Default
}

/**
 * Get the series color setting for charts
 */
export function getSeriesColor(dashboardSettings: Map<string, SettingValue>): string {
  const seriesColor = dashboardSettings.get('seriesColor');
  if (typeof seriesColor === 'string') {
    return seriesColor;
  }
  return '#2563eb'; // Default blue
}
