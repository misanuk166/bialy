import type { GlobalSettings } from '../types/appState';
import type { SettingValue } from '../services/settingsService';

/**
 * Apply dashboard settings to global settings
 * This function takes the loaded dashboard settings and applies them to override
 * the default global settings for things like date range, aggregation, visibility, etc.
 */
export function applyDashboardSettings(
  baseSettings: GlobalSettings,
  _dashboardSettings: Map<string, SettingValue>
): GlobalSettings {
  const updatedSettings = { ...baseSettings };

  // NOTE: Date range is NOT applied from dashboard settings
  // Date range is part of the dashboard's working state (saved in global_settings)
  // and should not be overridden by preference settings.
  // Only UI preferences (decimal places, colors, etc.) are applied here.
  //
  // Future preference settings (like display options) can be applied here
  // by reading from _dashboardSettings

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

/**
 * Get the shadow line color setting for charts
 */
export function getShadowColor(dashboardSettings: Map<string, SettingValue>): string {
  const shadowColor = dashboardSettings.get('shadowColor');
  if (typeof shadowColor === 'string') {
    return shadowColor;
  }
  return '#9ca3af'; // Default gray
}

/**
 * Get the shadow line style setting for charts
 */
export function getShadowLineStyle(dashboardSettings: Map<string, SettingValue>): 'solid' | 'dashed' | 'dotted' | 'dashdot' {
  const shadowLineStyle = dashboardSettings.get('shadowLineStyle');
  if (typeof shadowLineStyle === 'string' &&
      ['solid', 'dashed', 'dotted', 'dashdot'].includes(shadowLineStyle)) {
    return shadowLineStyle as 'solid' | 'dashed' | 'dotted' | 'dashdot';
  }
  return 'dashed'; // Default
}
