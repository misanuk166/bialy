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

  // Apply aggregation mode setting
  const aggregationMode = dashboardSettings.get('aggregationMode') as string | undefined;
  if (aggregationMode) {
    switch (aggregationMode) {
      case 'none':
        updatedSettings.aggregation = {
          ...updatedSettings.aggregation,
          enabled: false
        };
        break;
      case '7day':
        updatedSettings.aggregation = {
          enabled: true,
          mode: 'smoothing',
          period: 7,
          unit: 'days',
          groupByPeriod: 'week' // Required field, though not used in smoothing mode
        };
        break;
      case '30day':
        updatedSettings.aggregation = {
          enabled: true,
          mode: 'smoothing',
          period: 30,
          unit: 'days',
          groupByPeriod: 'week' // Required field, though not used in smoothing mode
        };
        break;
      case 'week':
        updatedSettings.aggregation = {
          enabled: true,
          mode: 'groupBy',
          period: 7, // Required field, though not used in groupBy mode
          unit: 'days',
          groupByPeriod: 'week'
        };
        break;
      case 'month':
        updatedSettings.aggregation = {
          enabled: true,
          mode: 'groupBy',
          period: 30, // Required field, though not used in groupBy mode
          unit: 'days',
          groupByPeriod: 'month'
        };
        break;
    }
  }

  // Apply visibility settings
  const showShadows = dashboardSettings.get('showShadows') as boolean | undefined;
  if (showShadows !== undefined) {
    // If shadows should be hidden, disable all existing shadows
    if (!showShadows && updatedSettings.shadows) {
      updatedSettings.shadows = updatedSettings.shadows.map(shadow => ({
        ...shadow,
        enabled: false
      }));
    }
  }

  const showAnnotations = dashboardSettings.get('showAnnotations') as boolean | undefined;
  if (showAnnotations !== undefined) {
    updatedSettings.annotationsEnabled = showAnnotations;
  }

  // Note: showGoals and showConfidenceIntervals are applied at the metric level,
  // not in globalSettings, so they're handled separately in the chart rendering logic

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
 * Check if goals should be shown
 */
export function shouldShowGoals(dashboardSettings: Map<string, SettingValue>): boolean {
  const showGoals = dashboardSettings.get('showGoals');
  return showGoals !== false; // Default to true
}

/**
 * Check if confidence intervals should be shown
 */
export function shouldShowConfidenceIntervals(dashboardSettings: Map<string, SettingValue>): boolean {
  const showConfidenceIntervals = dashboardSettings.get('showConfidenceIntervals');
  return showConfidenceIntervals !== false; // Default to true
}
