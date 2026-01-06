import { useState } from 'react';
import { updateDashboard } from '../services/dashboardService';
import type { Dashboard, PermissionLevel } from '../types/dashboard';

interface ShareDashboardModalProps {
  dashboard: Dashboard;
  onClose: () => void;
  onUpdate: (updated: Dashboard) => void;
}

export function ShareDashboardModal({ dashboard, onClose, onUpdate }: ShareDashboardModalProps) {
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>(dashboard.permission_level);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareableLink = `${window.location.origin}/?dashboard=${dashboard.id}`;
  const showLink = permissionLevel !== 'private';

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updated = await updateDashboard(dashboard.id, { permission_level: permissionLevel });
      onUpdate(updated);

      // Close modal after short delay to show success
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sharing settings');
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const hasChanges = permissionLevel !== dashboard.permission_level;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Share Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Dashboard Name */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">Sharing settings for:</p>
          <p className="text-lg font-semibold text-gray-900">{dashboard.name}</p>
        </div>

        {/* Permission Level Options */}
        <div className="space-y-3 mb-6">
          <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="permission"
              value="private"
              checked={permissionLevel === 'private'}
              onChange={(e) => setPermissionLevel(e.target.value as PermissionLevel)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Private</div>
              <div className="text-sm text-gray-600">Only you can access this dashboard</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="permission"
              value="domain"
              checked={permissionLevel === 'domain'}
              onChange={(e) => setPermissionLevel(e.target.value as PermissionLevel)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Anyone with link (same domain)</div>
              <div className="text-sm text-gray-600">
                People with the same email domain can view (read-only)
              </div>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="permission"
              value="public"
              checked={permissionLevel === 'public'}
              onChange={(e) => setPermissionLevel(e.target.value as PermissionLevel)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Public</div>
              <div className="text-sm text-gray-600">
                Anyone with the link can view (read-only)
              </div>
            </div>
          </label>
        </div>

        {/* Shareable Link */}
        {showLink && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-900 mb-2">Shareable Link</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareableLink}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-white border border-blue-300 rounded text-gray-700 font-mono"
              />
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {permissionLevel === 'domain' && (
              <div className="mt-2 text-xs text-blue-800">
                Only users with the same email domain as you can access this link
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !hasChanges || saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
