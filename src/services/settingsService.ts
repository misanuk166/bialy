import { supabase } from '../lib/supabase';

// Setting value type (can be any JSON-serializable value)
export type SettingValue = string | number | boolean | null;

// Dashboard setting record from database
export interface DashboardSettingRecord {
  id: string;
  user_id: string;
  dashboard_id: string | null;  // null for global settings
  setting_id: string;
  setting_value: SettingValue;
  created_at: string;
  updated_at: string;
}

// Structured settings data for the UI
export interface DashboardSettingsData {
  globalSettings: Map<string, SettingValue>;
  dashboardSettings: Map<string, Map<string, SettingValue>>;  // dashboard_id -> setting_id -> value
}

/**
 * Fetch all dashboard settings for the current user
 * Returns global settings and all dashboard-specific overrides
 */
export async function fetchDashboardSettings(): Promise<DashboardSettingsData> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('dashboard_settings')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching dashboard settings:', error);
    throw error;
  }

  // Organize settings into global and dashboard-specific
  const globalSettings = new Map<string, SettingValue>();
  const dashboardSettings = new Map<string, Map<string, SettingValue>>();

  (data || []).forEach((record: DashboardSettingRecord) => {
    if (record.dashboard_id === null) {
      // Global setting
      globalSettings.set(record.setting_id, record.setting_value);
    } else {
      // Dashboard-specific setting
      if (!dashboardSettings.has(record.dashboard_id)) {
        dashboardSettings.set(record.dashboard_id, new Map());
      }
      dashboardSettings.get(record.dashboard_id)!.set(record.setting_id, record.setting_value);
    }
  });

  return {
    globalSettings,
    dashboardSettings
  };
}

/**
 * Fetch settings for a specific dashboard
 * Returns global settings merged with dashboard-specific overrides
 */
export async function fetchDashboardSettingsForDashboard(
  dashboardId: string
): Promise<Map<string, SettingValue>> {
  const allSettings = await fetchDashboardSettings();

  // Start with global settings
  const mergedSettings = new Map(allSettings.globalSettings);

  // Apply dashboard-specific overrides
  const dashboardOverrides = allSettings.dashboardSettings.get(dashboardId);
  if (dashboardOverrides) {
    dashboardOverrides.forEach((value, settingId) => {
      mergedSettings.set(settingId, value);
    });
  }

  return mergedSettings;
}

/**
 * Save a global setting
 */
export async function saveGlobalSetting(
  settingId: string,
  value: SettingValue
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('dashboard_settings')
    .upsert({
      user_id: user.id,
      dashboard_id: null,
      setting_id: settingId,
      setting_value: value,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,dashboard_id,setting_id'
    });

  if (error) {
    console.error('Error saving global setting:', error);
    throw error;
  }
}

/**
 * Save a dashboard-specific setting
 */
export async function saveDashboardSetting(
  dashboardId: string,
  settingId: string,
  value: SettingValue
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('dashboard_settings')
    .upsert({
      user_id: user.id,
      dashboard_id: dashboardId,
      setting_id: settingId,
      setting_value: value,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,dashboard_id,setting_id'
    });

  if (error) {
    console.error('Error saving dashboard setting:', error);
    throw error;
  }
}

/**
 * Delete a dashboard-specific setting (revert to global default)
 */
export async function deleteDashboardSetting(
  dashboardId: string,
  settingId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('dashboard_settings')
    .delete()
    .eq('user_id', user.id)
    .eq('dashboard_id', dashboardId)
    .eq('setting_id', settingId);

  if (error) {
    console.error('Error deleting dashboard setting:', error);
    throw error;
  }
}

/**
 * Delete all dashboard-specific settings for a dashboard (reset all overrides)
 */
export async function deleteAllDashboardSettings(dashboardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('dashboard_settings')
    .delete()
    .eq('user_id', user.id)
    .eq('dashboard_id', dashboardId);

  if (error) {
    console.error('Error deleting all dashboard settings:', error);
    throw error;
  }
}

/**
 * Batch save multiple settings (optimized for bulk updates)
 */
export async function saveBatchSettings(
  settings: Array<{
    dashboardId: string | null;
    settingId: string;
    value: SettingValue;
  }>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const records = settings.map(s => ({
    user_id: user.id,
    dashboard_id: s.dashboardId,
    setting_id: s.settingId,
    setting_value: s.value,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('dashboard_settings')
    .upsert(records, {
      onConflict: 'user_id,dashboard_id,setting_id'
    });

  if (error) {
    console.error('Error batch saving settings:', error);
    throw error;
  }
}
