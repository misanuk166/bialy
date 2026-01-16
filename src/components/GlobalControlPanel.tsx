import { AggregateControls } from './AggregateControls';
import { ShadowControls } from './ShadowControls';
import { FocusPeriodControls } from './FocusPeriodControls';
import { AnnotationControls } from './AnnotationControls';
import type { GlobalSettings } from '../types/appState';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from '../types/shadow';
import type { FocusPeriod } from '../types/focusPeriod';
import type { Annotation } from '../types/annotation';

interface GlobalControlPanelProps {
  settings: GlobalSettings;
  dataExtent?: [Date, Date];
  onAggregationChange: (config: AggregationConfig) => void;
  onShadowsChange: (shadows: Shadow[], averageShadows: boolean, enabled: boolean) => void;
  onFocusPeriodChange: (focusPeriod: FocusPeriod) => void;
  onAnnotationsChange: (annotations: Annotation[], enabled: boolean) => void;
}

export function GlobalControlPanel({
  settings,
  dataExtent,
  onAggregationChange,
  onShadowsChange,
  onFocusPeriodChange,
  onAnnotationsChange
}: GlobalControlPanelProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6 sticky top-0 z-10 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Global Controls</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Aggregation</h3>
          <AggregateControls
            config={settings.aggregation || {
              enabled: false,
              mode: 'smoothing',
              period: 7,
              unit: 'days',
              groupByPeriod: 'month'
            }}
            onChange={onAggregationChange}
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Shadows</h3>
          <ShadowControls
            shadows={settings.shadows || []}
            onChange={(shadows) => onShadowsChange(shadows, settings.averageShadows || false, settings.shadowsEnabled !== false)}
            averageTogether={settings.averageShadows || false}
            onAverageTogetherChange={(avg) => onShadowsChange(settings.shadows || [], avg, settings.shadowsEnabled !== false)}
            enabled={settings.shadowsEnabled !== false}
            onEnabledChange={(enabled) => onShadowsChange(settings.shadows || [], settings.averageShadows || false, enabled)}
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Focus Period</h3>
          <FocusPeriodControls
            focusPeriod={settings.focusPeriod || { enabled: false }}
            onChange={onFocusPeriodChange}
            dataExtent={dataExtent}
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Annotations</h3>
          <AnnotationControls
            annotations={settings.annotations || []}
            onChange={(annotations) => onAnnotationsChange(annotations, settings.annotationsEnabled || false)}
            enabled={settings.annotationsEnabled || false}
            onEnabledChange={(enabled) => onAnnotationsChange(settings.annotations || [], enabled)}
          />
        </div>
      </div>
    </div>
  );
}
