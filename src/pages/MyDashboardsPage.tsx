import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { fetchDashboards, deleteDashboard, createDashboard } from '../services/dashboardService';
import type { Dashboard } from '../types/dashboard';

// Extended dashboard type with UI-specific fields
interface DashboardListItem extends Dashboard {
  favorited: boolean;
  saves: number;
  views: number;
  metricsCount: number;
  owner_name: string;
}

// Generate initials from dashboard name (1-3 letters)
function getDashboardInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return 'D';
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

// Generate consistent color from dashboard ID
function getDashboardColor(id: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-rose-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-fuchsia-500',
  ];

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) {
    return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function MyDashboardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [filteredDashboards, setFilteredDashboards] = useState<DashboardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'favorites'>('all');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentDashboardId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dashboards, searchTerm, activeFilter]);

  const loadDashboards = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDashboards();

      // Transform to DashboardListItem with mock data for UI-specific fields
      const listItems: DashboardListItem[] = data.map(d => ({
        ...d,
        favorited: false, // TODO: Load from user preferences
        saves: Math.floor(Math.random() * 50), // Mock data
        views: Math.floor(Math.random() * 500), // Mock data
        metricsCount: Math.floor(Math.random() * 20), // TODO: Load from dashboard_data
        owner_name: user?.email?.split('@')[0] || 'Unknown' // TODO: Join with users table
      }));

      setDashboards(listItems);
    } catch (error) {
      console.error('Failed to load dashboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...dashboards];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(term) ||
        (d.description && d.description.toLowerCase().includes(term))
      );
    }

    // Apply category filter
    if (activeFilter === 'favorites') {
      filtered = filtered.filter(d => d.favorited);
    } else if (activeFilter === 'recent') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(d => new Date(d.updated_at) > weekAgo);
    }

    setFilteredDashboards(filtered);
  };

  const handleCreateDashboard = async () => {
    try {
      const newDashboard = await createDashboard({ name: 'New Dashboard' });
      await loadDashboards();
      navigate(`/?dashboard=${newDashboard.id}`);
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      alert('Failed to create dashboard');
    }
  };

  const handleOpenDashboard = (dashboardId: string) => {
    navigate(`/?dashboard=${dashboardId}`);
  };

  const handleDeleteDashboard = async (dashboardId: string, dashboardName: string) => {
    if (!confirm(`Are you sure you want to delete "${dashboardName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteDashboard(dashboardId);
      setDashboards(prev => prev.filter(d => d.id !== dashboardId));

      // Remove from selection if selected
      if (selectedRows.has(dashboardId)) {
        const newSelection = new Set(selectedRows);
        newSelection.delete(dashboardId);
        setSelectedRows(newSelection);
      }
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      alert('Failed to delete dashboard');
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedRows.size;
    if (!confirm(`Are you sure you want to delete ${count} dashboard(s)? This cannot be undone.`)) {
      return;
    }

    try {
      await Promise.all([...selectedRows].map(id => deleteDashboard(id)));
      setDashboards(prev => prev.filter(d => !selectedRows.has(d.id)));
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Failed to delete dashboards:', error);
      alert('Failed to delete some dashboards');
    }
  };

  const handleToggleFavorite = (dashboardId: string) => {
    setDashboards(prev => prev.map(d =>
      d.id === dashboardId ? { ...d, favorited: !d.favorited } : d
    ));
    // TODO: Persist to database
  };

  const handleToggleRow = (dashboardId: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(dashboardId)) {
      newSelection.delete(dashboardId);
    } else {
      newSelection.add(dashboardId);
    }
    setSelectedRows(newSelection);
  };

  const handleToggleAll = () => {
    if (selectedRows.size === filteredDashboards.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredDashboards.map(d => d.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedRows(new Set());
  };

  const isAllSelected = filteredDashboards.length > 0 && selectedRows.size === filteredDashboards.length;
  const isIndeterminate = selectedRows.size > 0 && selectedRows.size < filteredDashboards.length;

  return (
    <>
      {/* Sidebar Navigation */}
      <Sidebar
        currentDashboardId={currentDashboardId}
        onShareDashboard={() => {}}
      />

      {/* Main Content Area */}
      <div className="ml-64 min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">My Dashboards</h1>
          <p className="text-sm text-gray-600 mt-1">Manage and organize all your dashboards</p>
        </div>

        {/* Content Body */}
        <div className="px-8 py-6 pb-24">
          {/* Toolbar */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5 flex items-center gap-3 flex-wrap shadow-sm">
            {/* Search Box */}
            <div className="flex-1 min-w-[300px] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search dashboards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeFilter === 'all'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>All</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{dashboards.length}</span>
              </button>
              <button
                onClick={() => setActiveFilter('recent')}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                  activeFilter === 'recent'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                📅 Recent
              </button>
              <button
                onClick={() => setActiveFilter('favorites')}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                  activeFilter === 'favorites'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                ⭐ Favorites
              </button>
            </div>

            {/* New Dashboard Button */}
            <button
              onClick={handleCreateDashboard}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              <span>New Dashboard</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = isIndeterminate;
                        }
                      }}
                      onChange={handleToggleAll}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Metrics</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Last Updated</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Saves</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Views</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      Loading dashboards...
                    </td>
                  </tr>
                ) : filteredDashboards.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="text-gray-400">
                        <div className="text-5xl mb-4">📊</div>
                        <h3 className="text-lg font-medium text-gray-600 mb-2">No dashboards found</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          {searchTerm || activeFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Get started by creating your first dashboard'}
                        </p>
                        {!searchTerm && activeFilter === 'all' && (
                          <button
                            onClick={handleCreateDashboard}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                          >
                            + New Dashboard
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDashboards.map((dashboard) => {
                    const initials = getDashboardInitials(dashboard.name);
                    const colorClass = getDashboardColor(dashboard.id);
                    const isSelected = selectedRows.has(dashboard.id);

                    return (
                      <tr
                        key={dashboard.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(dashboard.id)}
                            className="w-4 h-4 cursor-pointer accent-blue-600"
                          />
                        </td>

                        {/* Icon */}
                        <td className="px-4 py-4">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold ${colorClass}`}
                          >
                            {initials}
                          </div>
                        </td>

                        {/* Star */}
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleToggleFavorite(dashboard.id)}
                            className={`text-xl transition-all hover:scale-110 ${
                              dashboard.favorited ? 'text-amber-500' : 'text-gray-300'
                            }`}
                            title={dashboard.favorited ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {dashboard.favorited ? '★' : '☆'}
                          </button>
                        </td>

                        {/* Name & Description */}
                        <td className="px-4 py-4">
                          <div
                            onClick={() => handleOpenDashboard(dashboard.id)}
                            className="cursor-pointer"
                          >
                            <div className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                              {dashboard.name}
                            </div>
                            {dashboard.description && (
                              <div className="text-sm text-gray-600 mt-0.5 max-w-md truncate">
                                {dashboard.description}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Created By */}
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {dashboard.owner_name}
                        </td>

                        {/* Metrics Count */}
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-gray-900">{dashboard.metricsCount}</span>
                        </td>

                        {/* Last Updated */}
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatRelativeTime(dashboard.updated_at)}
                        </td>

                        {/* Saves */}
                        <td className="px-4 py-4 text-center text-sm text-gray-600">
                          {dashboard.saves}
                        </td>

                        {/* Views */}
                        <td className="px-4 py-4 text-center text-sm text-gray-600">
                          {dashboard.views}
                        </td>

                        {/* Delete Button */}
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleDeleteDashboard(dashboard.id, dashboard.name)}
                            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                            title="Delete dashboard"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      <div
        className={`fixed bottom-0 left-64 right-0 bg-gradient-to-r from-blue-700 to-blue-800 px-8 py-4 flex items-center justify-between shadow-2xl z-50 transition-transform duration-300 ${
          selectedRows.size > 0 ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3 text-white text-base font-semibold">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) {
                input.indeterminate = isIndeterminate;
              }
            }}
            onChange={handleToggleAll}
            className="w-5 h-5 cursor-pointer accent-white"
          />
          <span>{selectedRows.size} selected</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClearSelection}
            className="px-5 py-2 rounded-lg bg-white/15 border border-white/30 text-white font-semibold hover:bg-white/25 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkDelete}
            className="px-5 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected
          </button>
        </div>
      </div>
    </>
  );
}
