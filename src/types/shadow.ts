import type { TimeSeriesPoint } from './series';

export type ShadowPeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Shadow {
  id: string;
  enabled: boolean;
  periods: number;
  unit: ShadowPeriodUnit;
  label: string;
}

export interface ShadowData {
  shadow: Shadow;
  data: TimeSeriesPoint[];
  color: string;
}
