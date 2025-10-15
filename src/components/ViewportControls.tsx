import type { Viewport, ZoomPreset } from '../types/viewport';
import { createViewportFromPreset, panViewport, zoomViewport } from '../utils/viewport';

interface ViewportControlsProps {
  viewport: Viewport;
  fullRange: [Date, Date];
  onChange: (viewport: Viewport) => void;
}

export function ViewportControls({
  viewport,
  fullRange,
  onChange
}: ViewportControlsProps) {

  const handlePreset = (preset: ZoomPreset) => {
    const newViewport = createViewportFromPreset(preset, fullRange);
    onChange(newViewport);
  };

  const handlePan = (direction: 'left' | 'right') => {
    const panAmount = direction === 'left' ? -0.25 : 0.25;
    const newViewport = panViewport(viewport, fullRange, panAmount);
    onChange(newViewport);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const zoomFactor = direction === 'in' ? 1.5 : 0.67;
    const newViewport = zoomViewport(viewport, fullRange, zoomFactor);
    onChange(newViewport);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Time Window</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Zoom
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePreset('week')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              1 Week
            </button>
            <button
              onClick={() => handlePreset('month')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              1 Month
            </button>
            <button
              onClick={() => handlePreset('quarter')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              3 Months
            </button>
            <button
              onClick={() => handlePreset('year')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              1 Year
            </button>
            <button
              onClick={() => handlePreset('all')}
              className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors col-span-2"
            >
              Show All
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pan & Zoom
          </label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handlePan('left')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Pan left"
            >
              ←
            </button>
            <button
              onClick={() => handleZoom('out')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Zoom out"
            >
              −
            </button>
            <button
              onClick={() => handleZoom('in')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => handlePan('right')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Pan right"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
