import { useState } from 'react';
import type { Goal, GoalType } from '../types/goal';

interface GoalControlsProps {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
}

export function GoalControls({
  goals,
  onChange
}: GoalControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<GoalType>('continuous');
  const [label, setLabel] = useState('');

  // Continuous goal fields
  const [targetValue, setTargetValue] = useState('');

  // End-of-period goal fields
  const [endValue, setEndValue] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDate, setStartDate] = useState('');

  const handleToggleGoal = (goalId: string) => {
    onChange(
      goals.map(g =>
        g.id === goalId ? { ...g, enabled: !g.enabled } : g
      )
    );
  };

  const handleDeleteGoal = (goalId: string) => {
    onChange(goals.filter(g => g.id !== goalId));
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setGoalType(goal.type);
    setLabel(goal.label);

    if (goal.type === 'continuous') {
      setTargetValue(goal.targetValue?.toString() || '');
    } else if (goal.type === 'end-of-period') {
      setEndValue(goal.endValue?.toString() || '');
      setEndDate(goal.endDate ? goal.endDate.toISOString().split('T')[0] : '');
      setStartDate(goal.startDate ? goal.startDate.toISOString().split('T')[0] : '');
    }
  };

  const handleSaveEdit = () => {
    if (!editingGoalId) return;

    if (goalType === 'continuous') {
      if (!targetValue || !label) return;

      onChange(
        goals.map(g =>
          g.id === editingGoalId
            ? { ...g, type: 'continuous', targetValue: parseFloat(targetValue), label }
            : g
        )
      );
    } else if (goalType === 'end-of-period') {
      if (!endValue || !endDate || !startDate || !label) return;

      onChange(
        goals.map(g =>
          g.id === editingGoalId
            ? {
                ...g,
                type: 'end-of-period',
                endValue: parseFloat(endValue),
                endDate: new Date(endDate),
                startDate: new Date(startDate),
                interpolation: 'linear' as const,
                label
              }
            : g
        )
      );
    }

    // Reset form
    setEditingGoalId(null);
    setLabel('');
    setTargetValue('');
    setEndValue('');
    setEndDate('');
    setStartDate('');
  };

  const handleCreateGoal = () => {
    if (goalType === 'continuous') {
      if (!targetValue || !label) return;

      const newGoal: Goal = {
        id: crypto.randomUUID(),
        enabled: true,
        type: 'continuous',
        targetValue: parseFloat(targetValue),
        label
      };

      onChange([...goals, newGoal]);
    } else if (goalType === 'end-of-period') {
      if (!endValue || !endDate || !startDate || !label) return;

      const newGoal: Goal = {
        id: crypto.randomUUID(),
        enabled: true,
        type: 'end-of-period',
        endValue: parseFloat(endValue),
        endDate: new Date(endDate),
        startDate: new Date(startDate),
        interpolation: 'linear',
        label
      };

      onChange([...goals, newGoal]);
    }

    // Reset form
    setLabel('');
    setTargetValue('');
    setEndValue('');
    setEndDate('');
    setStartDate('');
    setIsCreating(false);
  };

  const handleCancel = () => {
    setLabel('');
    setTargetValue('');
    setEndValue('');
    setEndDate('');
    setStartDate('');
    setIsCreating(false);
    setEditingGoalId(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900">Goals</h3>
        </div>
        {isExpanded && !isCreating && !editingGoalId && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            + Add Goal
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {/* Creation/Edit form */}
          {(isCreating || editingGoalId) && (
            <div className="border border-blue-300 bg-blue-50 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Type
                </label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as GoalType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="continuous">Continuous Target</option>
                  <option value="end-of-period">End-of-Period Target</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Q4 Target"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {goalType === 'continuous' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g., 100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={endValue}
                      onChange={(e) => setEndValue(e.target.value)}
                      placeholder="e.g., 150"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={editingGoalId ? handleSaveEdit : handleCreateGoal}
                  disabled={
                    !label ||
                    (goalType === 'continuous' && !targetValue) ||
                    (goalType === 'end-of-period' && (!endValue || !endDate || !startDate))
                  }
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {editingGoalId ? 'Save Changes' : 'Create Goal'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Goals list */}
          {goals.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Active Goals ({goals.length})</div>
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={goal.enabled}
                      onChange={() => handleToggleGoal(goal.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{goal.label}</div>
                      <div className="text-xs text-gray-500">
                        {goal.type === 'continuous'
                          ? `Target: ${goal.targetValue}`
                          : `Target: ${goal.endValue} by ${goal.endDate?.toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditGoal(goal)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit goal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete goal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : !isCreating ? (
            <div className="text-sm text-gray-500 text-center py-4">
              No goals created yet. Click "Add Goal" to create one.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
