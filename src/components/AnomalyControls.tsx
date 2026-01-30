import { useState } from 'react';
import type { AnomalyConfig } from '../types/anomaly';

interface AnomalyControlsProps {
  config: AnomalyConfig;
  onChange: (config: AnomalyConfig) => void;
  anomalyCount?: number;
  totalPoints?: number;
  isDetecting?: boolean;
  onDetect?: () => void;
}

export function AnomalyControls({
  config,
  onChange,
  anomalyCount,
  totalPoints,
  isDetecting = false,
  onDetect
}: AnomalyControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = () => {
    const newEnabled = !config.enabled;
    // Auto-expand when toggling on
    if (newEnabled) {
      setIsExpanded(true);
    }
    onChange({ ...config, enabled: newEnabled });

    // Auto-detect when enabling
    if (newEnabled && onDetect) {
      onDetect();
    }
  };

  const handleSensitivityChange = (sensitivity: 'low' | 'medium' | 'high') => {
    onChange({ ...config, sensitivity });
    // Auto-detect after sensitivity change
    if (config.enabled && onDetect) {
      onDetect();
    }
  };

  const handleShowConfidenceBandsToggle = () => {
    onChange({ ...config, showConfidenceBands: !config.showConfidenceBands });
  };

  const anomalyRate = totalPoints && anomalyCount !== undefined
    ? ((anomalyCount / totalPoints) * 100).toFixed(1)
    : null;

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
          <h3 className="text-sm font-semibold text-gray-900">Anomaly Detection</h3>
          {anomalyCount !== undefined && anomalyCount > 0 && config.enabled && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
              {anomalyCount} {anomalyCount === 1 ? 'anomaly' : 'anomalies'}
            </span>
          )}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
        </label>
      </div>

      {config.enabled && isExpanded && (
        <div className="space-y-2">
          {/* Sensitivity */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Sensitivity
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSensitivityChange('low')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  config.sensitivity === 'low'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="90% confidence - More lenient, flags only extreme outliers"
              >
                Low
              </button>
              <button
                onClick={() => handleSensitivityChange('medium')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  config.sensitivity === 'medium'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="95% confidence - Balanced approach (recommended)"
              >
                Medium
              </button>
              <button
                onClick={() => handleSensitivityChange('high')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  config.sensitivity === 'high'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="99% confidence - Very strict, flags even minor deviations"
              >
                High
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {config.sensitivity === 'low' && 'Flags only extreme outliers (90% CI)'}
              {config.sensitivity === 'medium' && 'Balanced detection (95% CI)'}
              {config.sensitivity === 'high' && 'Very strict detection (99% CI)'}
            </p>
          </div>

          {/* Show Confidence Bands */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={config.showConfidenceBands}
                onChange={handleShowConfidenceBandsToggle}
                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded"
              />
              Show Confidence Bands
            </label>
            <p className="text-xs text-gray-500 ml-6 mt-0.5">
              Display expected value range on chart
            </p>
          </div>

          {/* Statistics */}
          {anomalyCount !== undefined && totalPoints !== undefined && (
            <div className="pt-2 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Anomalies:</span>
                  <span className="ml-1 font-medium">{anomalyCount}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rate:</span>
                  <span className="ml-1 font-medium">{anomalyRate}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Detect Button */}
          {onDetect && (
            <div className="pt-2">
              <button
                onClick={onDetect}
                disabled={isDetecting}
                className="w-full px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDetecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Detecting...
                  </span>
                ) : (
                  'Detect Anomalies'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
