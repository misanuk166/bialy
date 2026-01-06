import { useState, useEffect } from 'react';
import type { Dashboard } from '../types/dashboard';
import { fetchDashboards, createDashboard, updateDashboard, deleteDashboard } from '../services/dashboardService';

interface DashboardSelectorProps {
  currentDashboardId: string | null;
  onSelectDashboard: (dashboardId: string) => void;
}

export function DashboardSelector({ currentDashboardId, onSelectDashboard }: DashboardSelectorProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboards();
      setDashboards(data);

      // If no current dashboard but we have dashboards, select the first one
      if (!currentDashboardId && data.length > 0) {
        onSelectDashboard(data[0].id);
      }
    } catch (err) {
      setError('Failed to load dashboards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) {
      setError('Dashboard name is required');
      return;
    }

    try {
      setError(null);
      const dashboard = await createDashboard({ name: newDashboardName.trim() });
      setDashboards([dashboard, ...dashboards]);
      setShowCreateModal(false);
      setNewDashboardName('');
      onSelectDashboard(dashboard.id);
    } catch (err) {
      setError('Failed to create dashboard');
      console.error(err);
    }
  };

  const handleRenameDashboard = async () => {
    if (!selectedDashboard || !newDashboardName.trim()) {
      setError('Dashboard name is required');
      return;
    }

    try {
      setError(null);
      const updated = await updateDashboard(selectedDashboard.id, { name: newDashboardName.trim() });
      setDashboards(dashboards.map(d => d.id === updated.id ? updated : d));
      setShowRenameModal(false);
      setNewDashboardName('');
      setSelectedDashboard(null);
    } catch (err) {
      setError('Failed to rename dashboard');
      console.error(err);
    }
  };

  const handleDeleteDashboard = async () => {
    if (!selectedDashboard) return;

    try {
      setError(null);
      await deleteDashboard(selectedDashboard.id);
      const remainingDashboards = dashboards.filter(d => d.id !== selectedDashboard.id);
      setDashboards(remainingDashboards);
      setShowDeleteConfirm(false);
      setSelectedDashboard(null);

      // If we deleted the current dashboard, switch to the first available one
      if (currentDashboardId === selectedDashboard.id && remainingDashboards.length > 0) {
        onSelectDashboard(remainingDashboards[0].id);
      }
    } catch (err) {
      setError('Failed to delete dashboard');
      console.error(err);
    }
  };

  const openRenameModal = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
    setNewDashboardName(dashboard.name);
    setShowRenameModal(true);
  };

  const openDeleteConfirm = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
    setShowDeleteConfirm(true);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse text-gray-600">Loading dashboards...</div>
      </div>
    );
  }

  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);

  return (
    <div className="relative">
      {/* Dashboard Dropdown */}
      <div className="flex items-center gap-2">
        <select
          value={currentDashboardId || ''}
          onChange={(e) => onSelectDashboard(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {dashboards.length === 0 && (
            <option value="">No dashboards</option>
          )}
          {dashboards.map((dashboard) => (
            <option key={dashboard.id} value={dashboard.id}>
              {dashboard.name}
            </option>
          ))}
        </select>

        {/* Action Buttons */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Create new dashboard"
        >
          + New
        </button>

        {currentDashboard && (
          <>
            <button
              onClick={() => openRenameModal(currentDashboard)}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              title="Rename dashboard"
            >
              Rename
            </button>
            <button
              onClick={() => openDeleteConfirm(currentDashboard)}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="Delete dashboard"
              disabled={dashboards.length <= 1}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Create Dashboard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Dashboard</h2>
            <input
              type="text"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateDashboard();
                if (e.key === 'Escape') {
                  setShowCreateModal(false);
                  setNewDashboardName('');
                }
              }}
              placeholder="Dashboard name"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewDashboardName('');
                  setError(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDashboard}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dashboard Modal */}
      {showRenameModal && selectedDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Rename Dashboard</h2>
            <input
              type="text"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameDashboard();
                if (e.key === 'Escape') {
                  setShowRenameModal(false);
                  setNewDashboardName('');
                  setSelectedDashboard(null);
                }
              }}
              placeholder="Dashboard name"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setNewDashboardName('');
                  setSelectedDashboard(null);
                  setError(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameDashboard}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Delete Dashboard</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete "{selectedDashboard.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedDashboard(null);
                  setError(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDashboard}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
