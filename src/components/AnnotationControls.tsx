import { useState } from 'react';
import type { Annotation, AnnotationType } from '../types/annotation';
import { getAllPresets } from '../utils/annotationPresets';

interface AnnotationControlsProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function AnnotationControls({
  annotations,
  onChange,
  enabled,
  onEnabledChange
}: AnnotationControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [annotationType, setAnnotationType] = useState<AnnotationType>('event');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');

  // Event annotation fields
  const [date, setDate] = useState('');

  // Range annotation fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Point annotation fields
  const [value, setValue] = useState('');

  // Preset modal state
  const [showPresetModal, setShowPresetModal] = useState(false);

  const handleToggleAnnotation = (annotationId: string) => {
    onChange(
      annotations.map(a =>
        a.id === annotationId ? { ...a, enabled: !a.enabled } : a
      )
    );
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    onChange(annotations.filter(a => a.id !== annotationId));
  };

  const handleEditAnnotation = (annotation: Annotation) => {
    setEditingAnnotationId(annotation.id);
    setAnnotationType(annotation.type);
    setLabel(annotation.label);
    setDescription(annotation.description || '');
    setColor(annotation.color || '');

    if (annotation.type === 'event') {
      setDate(annotation.date ? annotation.date.toISOString().split('T')[0] : '');
    } else if (annotation.type === 'range') {
      setStartDate(annotation.startDate ? annotation.startDate.toISOString().split('T')[0] : '');
      setEndDate(annotation.endDate ? annotation.endDate.toISOString().split('T')[0] : '');
    } else if (annotation.type === 'point') {
      setDate(annotation.date ? annotation.date.toISOString().split('T')[0] : '');
      setValue(annotation.value?.toString() || '');
    }
  };

  const handleSaveEdit = () => {
    if (!editingAnnotationId) return;

    if (annotationType === 'event') {
      if (!date || !label) return;

      onChange(
        annotations.map(a =>
          a.id === editingAnnotationId
            ? { ...a, type: 'event', label, description, color, date: new Date(date) }
            : a
        )
      );
    } else if (annotationType === 'range') {
      if (!startDate || !endDate || !label) return;

      onChange(
        annotations.map(a =>
          a.id === editingAnnotationId
            ? {
                ...a,
                type: 'range',
                label,
                description,
                color,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
              }
            : a
        )
      );
    } else if (annotationType === 'point') {
      if (!date || !value || !label) return;

      onChange(
        annotations.map(a =>
          a.id === editingAnnotationId
            ? {
                ...a,
                type: 'point',
                label,
                description,
                color,
                date: new Date(date),
                value: parseFloat(value)
              }
            : a
        )
      );
    }

    handleCancel();
  };

  const handleCreateAnnotation = () => {
    if (annotationType === 'event') {
      if (!date || !label) return;

      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        enabled: true,
        type: 'event',
        label,
        description: description || undefined,
        color: color || undefined,
        date: new Date(date),
        style: 'solid',
        position: 'top'
      };

      onChange([...annotations, newAnnotation]);
    } else if (annotationType === 'range') {
      if (!startDate || !endDate || !label) return;

      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        enabled: true,
        type: 'range',
        label,
        description: description || undefined,
        color: color || undefined,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        opacity: 0.15
      };

      onChange([...annotations, newAnnotation]);
    } else if (annotationType === 'point') {
      if (!date || !value || !label) return;

      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        enabled: true,
        type: 'point',
        label,
        description: description || undefined,
        color: color || undefined,
        date: new Date(date),
        value: parseFloat(value),
        position: 'top'
      };

      onChange([...annotations, newAnnotation]);
    }

    handleCancel();
  };

  const handleCancel = () => {
    setLabel('');
    setDescription('');
    setColor('');
    setDate('');
    setStartDate('');
    setEndDate('');
    setValue('');
    setIsCreating(false);
    setEditingAnnotationId(null);
  };

  const handleToggle = () => {
    const newEnabled = !enabled;
    if (newEnabled) {
      setIsExpanded(true);
    }
    onEnabledChange(newEnabled);
  };

  const handleLoadPreset = (presetId: string) => {
    const presets = getAllPresets();
    const preset = presets.find(p => p.id === presetId);

    if (preset) {
      // Add preset annotations to existing ones
      onChange([...annotations, ...preset.annotations]);
      setShowPresetModal(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Annotations</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {enabled && isExpanded && (
        <div className="space-y-2">
          {/* Creation/Edit form */}
          {(isCreating || editingAnnotationId) && (
            <div className="border border-gray-200 bg-white rounded-lg p-3 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Annotation Type
                </label>
                <select
                  value={annotationType}
                  onChange={(e) => setAnnotationType(e.target.value as AnnotationType)}
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
                >
                  <option value="event">Event (Vertical Line)</option>
                  <option value="range">Range (Shaded Period)</option>
                  <option value="point">Point (Marker)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Black Friday"
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Major shopping event"
                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                />
              </div>

              {annotationType === 'event' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
              )}

              {annotationType === 'range' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>
                </>
              )}

              {annotationType === 'point' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="e.g., 100"
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Color (Optional)
                </label>
                <input
                  type="color"
                  value={color || '#f97316'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-8 px-1 py-1 border border-gray-300 rounded"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={editingAnnotationId ? handleSaveEdit : handleCreateAnnotation}
                  disabled={
                    !label ||
                    (annotationType === 'event' && !date) ||
                    (annotationType === 'range' && (!startDate || !endDate)) ||
                    (annotationType === 'point' && (!date || !value))
                  }
                  className="flex-1 text-xs px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {editingAnnotationId ? 'Save Changes' : 'Create Annotation'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 text-xs px-2 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Annotations list */}
          {annotations.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700">
                Active Annotations ({annotations.length})
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={annotation.enabled}
                          onChange={() => handleToggleAnnotation(annotation.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: annotation.color || '#f97316' }}
                      />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-900">
                          {annotation.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {annotation.type === 'event'
                            ? `Event: ${annotation.date?.toLocaleDateString()}`
                            : annotation.type === 'range'
                            ? `Range: ${annotation.startDate?.toLocaleDateString()} - ${annotation.endDate?.toLocaleDateString()}`
                            : `Point: ${annotation.date?.toLocaleDateString()}, value ${annotation.value}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditAnnotation(annotation)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit annotation"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteAnnotation(annotation.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete annotation"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !isCreating ? (
            <div className="text-xs text-gray-500 text-center py-3">
              No annotations created yet. Click "Add Annotation" or "Load Preset" to get started.
            </div>
          ) : null}

          {!isCreating && !editingAnnotationId && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsCreating(true)}
                className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                + Add Annotation
              </button>
              <button
                onClick={() => setShowPresetModal(true)}
                className="flex-1 px-2 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
              >
                Load Preset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Annotation Preset</h3>
            <div className="space-y-3 mb-6">
              {getAllPresets().map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset.id)}
                  className="w-full text-left p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">{preset.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {preset.annotations.length} annotations
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPresetModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
