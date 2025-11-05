import type { TimeSeriesPoint } from '../types/series';
import type { Goal, GoalData } from '../types/goal';

/**
 * Get the start of the quarter for a given date
 */
function getQuarterStart(referenceDate: Date): Date {
  const date = new Date(referenceDate);
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
}

/**
 * Generate goal data for a continuous target value goal
 * Returns a horizontal line across the data range at the target value
 */
function generateContinuousGoalData(
  seriesData: TimeSeriesPoint[],
  goal: Goal,
  dateRange?: [Date, Date]
): TimeSeriesPoint[] {
  if (!goal.targetValue || seriesData.length === 0) return [];

  // Use provided date range or fall back to series data range
  let firstDate: Date, lastDate: Date;
  if (dateRange) {
    firstDate = dateRange[0];
    lastDate = dateRange[1];
  } else {
    firstDate = seriesData[0].date;
    lastDate = seriesData[seriesData.length - 1].date;
  }

  return [
    {
      date: firstDate,
      numerator: goal.targetValue,
      denominator: 1
    },
    {
      date: lastDate,
      numerator: goal.targetValue,
      denominator: 1
    }
  ];
}

/**
 * Generate goal data for an end-of-period goal
 * Interpolates from start value to end value
 */
function generateEndOfPeriodGoalData(
  seriesData: TimeSeriesPoint[],
  goal: Goal
): TimeSeriesPoint[] {
  if (!goal.endDate || !goal.endValue || seriesData.length === 0) return [];

  // Determine start date - default to quarter start based on max series date
  let startDate: Date;
  if (goal.startDate) {
    startDate = goal.startDate;
  } else {
    // Get the maximum date from the series
    const maxDate = seriesData.reduce((max, point) =>
      point.date > max ? point.date : max,
      seriesData[0].date
    );
    startDate = getQuarterStart(maxDate);
  }

  // Determine start value
  let startValue: number;

  if (goal.startDate) {
    // Find the series value at the start date
    const startPoint = seriesData.find(p => {
      const diff = Math.abs(p.date.getTime() - startDate.getTime());
      return diff < 24 * 60 * 60 * 1000; // Within 1 day
    });

    if (startPoint) {
      startValue = startPoint.numerator / startPoint.denominator;
    } else {
      // Use most recent value before start date, or first available value
      const beforeStart = seriesData.filter(p => p.date <= startDate);
      if (beforeStart.length > 0) {
        const mostRecent = beforeStart[beforeStart.length - 1];
        startValue = mostRecent.numerator / mostRecent.denominator;
      } else {
        // Use first available series value
        startValue = seriesData[0].numerator / seriesData[0].denominator;
      }
    }
  } else {
    // Use most recent available series value
    const mostRecent = seriesData[seriesData.length - 1];
    startValue = mostRecent.numerator / mostRecent.denominator;
  }

  const endDate = goal.endDate;
  const endValue = goal.endValue;

  // Generate interpolated points (daily granularity)
  const points: TimeSeriesPoint[] = [];
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

  // Ensure at least start and end points
  if (totalDays <= 0) {
    return [{
      date: startDate,
      numerator: startValue,
      denominator: 1
    }];
  }

  // Linear interpolation
  const interpolation = goal.interpolation || 'linear';

  if (interpolation === 'linear') {
    // Create point at start
    points.push({
      date: new Date(startDate),
      numerator: startValue,
      denominator: 1
    });

    // Create intermediate points (one per day)
    for (let i = 1; i < totalDays; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const progress = i / totalDays;
      const value = startValue + (endValue - startValue) * progress;

      points.push({
        date,
        numerator: value,
        denominator: 1
      });
    }

    // Create point at end
    points.push({
      date: new Date(endDate),
      numerator: endValue,
      denominator: 1
    });
  }

  return points;
}

/**
 * Generate goal data based on goal type
 */
export function createGoalData(
  seriesData: TimeSeriesPoint[],
  goal: Goal,
  dateRange?: [Date, Date]
): TimeSeriesPoint[] {
  if (!goal.enabled) return [];

  switch (goal.type) {
    case 'continuous':
      return generateContinuousGoalData(seriesData, goal, dateRange);
    case 'end-of-period':
      return generateEndOfPeriodGoalData(seriesData, goal);
    default:
      return [];
  }
}

/**
 * Get color for a goal (distinct from shadows and main series)
 * Goals should be distinguishable - using variations of orange/amber
 */
export function getGoalColor(index: number): string {
  // Colors in orange/amber spectrum, from darker to lighter
  const colors = [
    '#f97316', // orange-500
    '#fb923c', // orange-400
    '#fbbf24', // amber-400
    '#fcd34d', // amber-300
    '#fde68a', // amber-200
  ];

  return colors[index % colors.length];
}

/**
 * Generate goal data for all enabled goals
 */
export function generateGoalsData(
  seriesData: TimeSeriesPoint[],
  goals: Goal[],
  forecastEndDate?: Date
): GoalData[] {
  const enabledGoals = goals.filter(g => g.enabled);

  if (seriesData.length === 0) return [];

  // First pass: generate all goals to determine full date extent
  const initialGoalsData = enabledGoals.map((goal, index) => ({
    goal,
    data: createGoalData(seriesData, goal),
    color: getGoalColor(index)
  }));

  // Calculate full date extent including all goals and forecast
  let minDate = seriesData[0].date;
  let maxDate = seriesData[seriesData.length - 1].date;

  // Extend maxDate to include forecast if available
  if (forecastEndDate && forecastEndDate > maxDate) {
    maxDate = forecastEndDate;
  }

  initialGoalsData.forEach(gd => {
    if (gd.data.length > 0) {
      const firstDate = gd.data[0].date;
      const lastDate = gd.data[gd.data.length - 1].date;
      if (firstDate < minDate) minDate = firstDate;
      if (lastDate > maxDate) maxDate = lastDate;
    }
  });

  const fullDateRange: [Date, Date] = [minDate, maxDate];

  // Second pass: regenerate continuous goals with full date range
  return enabledGoals.map((goal, index) => ({
    goal,
    data: createGoalData(seriesData, goal, fullDateRange),
    color: getGoalColor(index)
  }));
}

/**
 * Create a default continuous goal
 */
export function createContinuousGoal(
  targetValue: number,
  label?: string
): Goal {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'continuous',
    targetValue,
    label: label || `Target: ${targetValue}`
  };
}

/**
 * Create a default end-of-period goal
 */
export function createEndOfPeriodGoal(
  endValue: number,
  endDate: Date,
  startDate?: Date,
  label?: string
): Goal {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'end-of-period',
    endValue,
    endDate,
    startDate,
    interpolation: 'linear',
    label: label || `Goal: ${endValue} by ${endDate.toLocaleDateString()}`
  };
}
