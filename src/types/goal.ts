import type { TimeSeriesPoint } from './series';

export type GoalType = 'continuous' | 'end-of-period';

export interface Goal {
  id: string;
  enabled: boolean;
  type: GoalType;
  label: string;
  // For continuous goals
  targetValue?: number;
  // For end-of-period goals
  startDate?: Date;
  endDate?: Date;
  endValue?: number;
  interpolation?: 'linear'; // Future: could add 'exponential', 'logarithmic', etc.
}

export interface GoalData {
  goal: Goal;
  data: TimeSeriesPoint[];
  color: string;
}
