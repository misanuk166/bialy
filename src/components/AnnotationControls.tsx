import type { Annotation } from '../types/annotation';
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
  const handleLoadPreset = (presetId: string) => {
    if (!presetId) return;

    const presets = getAllPresets();
    const preset = presets.find(p => p.id === presetId);

    if (preset) {
      // Replace existing annotations with preset annotations
      onChange(preset.annotations);
    }
  };

  const handleToggleAnnotation = (annotationId: string) => {
    onChange(
      annotations.map(a =>
        a.id === annotationId ? { ...a, enabled: !a.enabled } : a
      )
    );
  };

  const handleClear = () => {
    onChange([]);
  };

  const handleToggle = () => {
    onEnabledChange(!enabled);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">
          Enable Annotations
        </label>
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

      <div className="h-px bg-gray-200"></div>

      <div className={`space-y-2 relative transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {!enabled && (
          <div className="absolute inset-0 bg-white/60 rounded z-10"></div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Load Preset
          </label>
          <select
            onChange={(e) => handleLoadPreset(e.target.value)}
            value=""
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded bg-white"
          >
            <option value="">Select a preset...</option>
            {getAllPresets().map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {annotations.length > 0 && (
          <>
            <div className="text-xs font-medium text-gray-700 pt-1">
              Active: {annotations.filter(a => a.enabled).length} of {annotations.length}
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-200 rounded p-2 bg-gray-50">
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annotation.enabled}
                      onChange={() => handleToggleAnnotation(annotation.id)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <div
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: annotation.color || '#f97316' }}
                  />
                  <span className="text-gray-900 truncate flex-1">
                    {annotation.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleClear}
              className="w-full text-xs px-2 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Clear All
            </button>
          </>
        )}

        {annotations.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">
            Select a preset to add annotations
          </div>
        )}
      </div>
    </div>
  );
}
