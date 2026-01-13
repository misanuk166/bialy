import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchDashboards, createDashboard, deleteDashboard } from '../services/dashboardService';
import type { Dashboard } from '../types/dashboard';

interface SidebarProps {
  currentDashboardId: string | null;
  onShareDashboard: (dashboard: Dashboard) => void;
}

// Generate initials from dashboard name (1-3 letters)
function getDashboardInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return 'D';
  if (words.length === 1) {
    // Single word: take first 2 letters
    return words[0].substring(0, 2).toUpperCase();
  }

  // Multiple words: take first letter of each word, up to 3 letters
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

  // Simple hash function to get consistent color for each ID
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
}

export function Sidebar({ currentDashboardId, onShareDashboard }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadDashboards = async () => {
      const data = await fetchDashboards();
      setDashboards(data);

      // Auto-select first dashboard if none selected (only on dashboard page)
      if (!currentDashboardId && data.length > 0 && window.location.pathname === '/') {
        navigate(`/?dashboard=${data[0].id}`);
      }
    };

    loadDashboards();
  }, [user, navigate, currentDashboardId]); // Re-fetch when currentDashboardId changes

  const handleCreateDashboard = async () => {
    if (!user || isCreating) return;

    setIsCreating(true);
    try {
      const newDashboard = await createDashboard({
        name: 'New Dashboard'
      });

      setDashboards(prev => [...prev, newDashboard]);
      navigate(`/?dashboard=${newDashboard.id}`);
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      alert('Failed to create dashboard');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDashboard = async (dashboardId: string, dashboardName: string) => {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${dashboardName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDashboard(dashboardId);

      // Remove from local state
      setDashboards(prev => prev.filter(d => d.id !== dashboardId));

      // If deleting current dashboard, navigate to another one
      if (dashboardId === currentDashboardId) {
        const remaining = dashboards.filter(d => d.id !== dashboardId);
        if (remaining.length > 0) {
          navigate(`/?dashboard=${remaining[0].id}`);
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      alert('Failed to delete dashboard');
    }
  };

  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);

  return (
    <div className="fixed left-0 top-0 w-64 h-screen bg-gradient-to-b from-slate-800 to-slate-900 border-r border-gray-700 flex flex-col z-50 shadow-xl">
      {/* App Logo/Header */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <span className="text-xl font-bold text-white tracking-tight">Bialy</span>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Recents Section */}
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 pb-2">
            Recents
          </div>
          <div className="space-y-0.5">
            {dashboards.slice(0, 3).map((dashboard) => {
              const initials = getDashboardInitials(dashboard.name);
              const colorClass = getDashboardColor(dashboard.id);
              const isActive = dashboard.id === currentDashboardId;

              return (
                <div
                  key={dashboard.id}
                  className="relative group"
                >
                  <button
                    onClick={() => navigate(`/?dashboard=${dashboard.id}`)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all text-left
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                      }
                    `}
                  >
                    {/* Dashboard Badge with Initials */}
                    <div
                      className={`
                        w-8 h-8 rounded-md flex items-center justify-center
                        text-white text-xs font-bold
                        ${isActive ? 'bg-white/20' : colorClass}
                      `}
                    >
                      {initials}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">
                      {dashboard.name}
                    </span>
                  </button>

                  {/* Delete Button (appears on hover) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDashboard(dashboard.id, dashboard.name);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                    title="Delete dashboard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add Dashboard Button */}
          <button
            onClick={handleCreateDashboard}
            disabled={isCreating}
            className="w-full mt-2 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:bg-gray-700/30 hover:border-gray-500 hover:text-gray-300 transition-all text-sm disabled:opacity-50"
          >
            <span>+</span>
            <span>New Dashboard</span>
          </button>
        </div>

        {/* Workspace Section */}
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 pb-2">
            Workspace
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => navigate('/dashboards')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all text-left text-sm"
            >
              <span className="text-lg">🏢</span>
              <span>My Dashboards</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all text-left text-sm">
              <span className="text-lg">👥</span>
              <span>Shared with Me</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all text-left text-sm">
              <span className="text-lg">⭐</span>
              <span>Favorites</span>
            </button>
          </div>
        </div>

        {/* Settings Section */}
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 pb-2">
            Settings
          </div>
          <div className="space-y-0.5">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all text-left text-sm">
              <span className="text-lg">⚙️</span>
              <span>Dashboard Settings</span>
            </button>
            <button
              onClick={() => {
                if (currentDashboard) {
                  onShareDashboard(currentDashboard);
                }
              }}
              disabled={!currentDashboard}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all text-left text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg">🔗</span>
              <span>Share & Permissions</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all text-left text-sm">
              <span className="text-lg">📤</span>
              <span>Export Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-700/50 transition-all"
        >
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
              {(user?.user_metadata?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
          )}
          <div className="flex-1 text-left overflow-hidden">
            <div className="text-sm font-semibold text-white truncate">
              {user?.user_metadata?.name || user?.email?.split('@')[0]}
            </div>
            <div className="text-xs text-gray-400 truncate">{user?.email}</div>
          </div>
        </button>
      </div>
    </div>
  );
}
