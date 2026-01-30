import { useEffect, useRef, useState, useMemo } from 'react';
import { select, pointer } from 'd3-selection';
import { scaleTime, scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3Line, area as d3Area, curveLinear } from 'd3-shape';
import { extent, min, max, bisector } from 'd3-array';
import { brush as d3Brush } from 'd3-brush';
import type { Series, TimeSeriesPoint } from '../types/series';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import type { ForecastConfig, ForecastSnapshot } from '../types/forecast';
import type { FocusPeriod } from '../types/focusPeriod';
import type { Annotation } from '../types/annotation';
import { applyAggregation } from '../utils/aggregation';
import { generateShadowsData, calculateShadowAverage } from '../utils/shadows';
import { generateGoalsData } from '../utils/goals';
import { generateAnnotationData, mergeAnnotations } from '../utils/annotations';

interface TimeSeriesChartProps {
  series: Series;
  aggregationConfig?: AggregationConfig;
  shadows?: Shadow[];
  shadowsEnabled?: boolean;
  averageShadows?: boolean;
  shadowColor?: string;
  shadowLineStyle?: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  goals?: Goal[];
  forecastConfig?: ForecastConfig;
  forecastSnapshot?: ForecastSnapshot;
  focusPeriod?: FocusPeriod;
  annotations?: Annotation[]; // Global annotations
  annotationsEnabled?: boolean; // Master toggle for annotations
  metricAnnotations?: Annotation[]; // Metric-specific annotations
  width?: number;
  height?: number;
  onSeriesUpdate?: (series: Series) => void;
}

/**
 * Desaturate a hex color by a percentage (0-100)
 * Used for Option 5: Progressive Saturation Fade
 * @param hex - Hex color (e.g., '#2563eb' or '2563eb')
 * @param percent - Percentage to desaturate (0 = no change, 100 = fully grayscale)
 * @returns Desaturated hex color
 */
function desaturateColor(hex: string, percent: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  // Reduce saturation based on percent (0 = original saturation, 100 = no saturation)
  const newS = s * (1 - percent / 100);

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let newR, newG, newB;
  if (newS === 0) {
    newR = newG = newB = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + newS) : l + newS - l * newS;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1/3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1/3);
  }

  // Convert back to hex
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

interface HoverData {
  date: string;
  value: number;
  rawValue?: number;
  precision?: number;
  shadowValue?: number;
  shadowLabel?: string;
  goalValue?: number;
  goalLabel?: string;
  forecastValue?: number;
  isForecast?: boolean;
}

// Helper function to determine decimal precision from a number
function getDecimalPrecision(num: number): number {
  const str = num.toString();
  if (!str.includes('.')) return 0;
  return str.split('.')[1].length;
}

// Helper function to format number with specific precision
function formatWithPrecision(num: number, precision: number): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
}

// Helper function to find goal value for a given date
function findGoalValue(
  date: Date,
  goalsData: Array<{ goal: Goal; data: Array<{ date: Date; value: number }> }>,
  selectedIndex: number = 0
): number | undefined {
  if (goalsData.length === 0) return undefined;

  const goalData = goalsData[selectedIndex];
  if (!goalData || goalData.data.length === 0) return undefined;

  // For continuous goals (2 points representing a horizontal line), return the constant value if date is within or after range
  if (goalData.goal.type === 'continuous' && goalData.data.length === 2) {
    const startDate = goalData.data[0].date;
    const endDate = goalData.data[1].date;
    // Return the constant value if date is within the range (including the forecast period)
    if (date >= startDate && date <= endDate) {
      return goalData.data[0].value; // Constant value
    }
  }

  // For end-of-period goals, find the closest point or interpolate
  const dateTime = date.getTime();

  // First try exact match with tolerance
  const exactMatch = goalData.data.find(p => {
    const diff = Math.abs(p.date.getTime() - dateTime);
    return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
  });

  if (exactMatch) return exactMatch.value;

  // If no exact match, find surrounding points and interpolate
  let before = null;
  let after = null;

  for (let i = 0; i < goalData.data.length - 1; i++) {
    if (goalData.data[i].date <= date && goalData.data[i + 1].date >= date) {
      before = goalData.data[i];
      after = goalData.data[i + 1];
      break;
    }
  }

  if (before && after) {
    // Linear interpolation
    const totalTime = after.date.getTime() - before.date.getTime();
    const elapsedTime = dateTime - before.date.getTime();
    const ratio = elapsedTime / totalTime;
    return before.value + (after.value - before.value) * ratio;
  }

  return undefined;
}

// Helper function to find shadow value for a given date
function findShadowValue(
  date: Date,
  shadowsData: Array<{ shadow: Shadow; data: Array<{ date: Date; value: number }> }>,
  averagedShadowData?: Array<{ date: Date; mean: number; stdDev: number }>,
  useAverage?: boolean
): number | undefined {
  // If using averaged shadow data
  if (useAverage && averagedShadowData && averagedShadowData.length > 0) {
    const dateTime = date.getTime();
    const point = averagedShadowData.find(p => {
      const diff = Math.abs(p.date.getTime() - dateTime);
      // Allow 1 day tolerance for matching
      return diff < 24 * 60 * 60 * 1000;
    });
    return point?.mean;
  }

  // Otherwise use the first enabled shadow
  if (shadowsData.length === 0) return undefined;

  const shadowData = shadowsData[0];
  if (!shadowData) return undefined;

  // Find the data point matching this date (with tolerance for time differences)
  const dateTime = date.getTime();
  const point = shadowData.data.find(p => {
    const diff = Math.abs(p.date.getTime() - dateTime);
    // Allow 1 day tolerance for matching
    return diff < 24 * 60 * 60 * 1000;
  });

  return point?.value;
}

// Helper function to detect expected interval between dates (in milliseconds)
function detectInterval(data: Array<{ date: Date; value: number }>): number {
  if (data.length < 2) return 0;

  // Calculate intervals between consecutive points
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(data.length, 10); i++) {
    intervals.push(data[i].date.getTime() - data[i - 1].date.getTime());
  }

  // Find the most common interval (mode)
  const intervalCounts = new Map<number, number>();
  intervals.forEach(interval => {
    intervalCounts.set(interval, (intervalCounts.get(interval) || 0) + 1);
  });

  let maxCount = 0;
  let commonInterval = 0;
  intervalCounts.forEach((count, interval) => {
    if (count > maxCount) {
      maxCount = count;
      commonInterval = interval;
    }
  });

  return commonInterval;
}

// Helper function to fill gaps in data with null values
function fillGapsWithNulls(
  data: Array<{ date: Date; value: number }>,
  threshold: number = 1.5
): Array<{ date: Date; value: number | null }> {
  if (data.length < 2) return data;

  const expectedInterval = detectInterval(data);
  if (expectedInterval === 0) return data;

  const result: Array<{ date: Date; value: number | null }> = [];

  for (let i = 0; i < data.length; i++) {
    result.push(data[i]);

    // Check if there's a gap to the next point
    if (i < data.length - 1) {
      const currentTime = data[i].date.getTime();
      const nextTime = data[i + 1].date.getTime();
      const actualInterval = nextTime - currentTime;

      // If gap is larger than threshold * expected interval, insert null
      if (actualInterval > expectedInterval * threshold) {
        // Insert null point right after current point
        result.push({
          date: new Date(currentTime + expectedInterval),
          value: null
        });
        // Insert null point right before next point
        result.push({
          date: new Date(nextTime - expectedInterval),
          value: null
        });
      }
    }
  }

  return result;
}

// Helper function to generate averaged shadow label
function getAveragedShadowLabel(shadows: Shadow[]): string {
  const enabledShadows = shadows.filter(s => s.enabled);
  if (enabledShadows.length === 0) return '';

  // Get the period and unit from the first shadow (assuming they're all the same type)
  const period = enabledShadows[0].periods;
  const unit = enabledShadows[0].unit;
  const count = enabledShadows.length;

  // Format: "avg of 5 2-month periods" or "3-year average" (if period is 1)
  if (period > 1) {
    return `avg of ${count} ${period}-${unit} periods`;
  } else {
    return `${count}-${unit} average`;
  }
}

// Helper function to convert line style to SVG strokeDasharray
function getStrokeDashArray(style: 'solid' | 'dashed' | 'dotted' | 'dashdot'): string | undefined {
  switch (style) {
    case 'solid':
      return undefined; // No dash array for solid lines
    case 'dashed':
      return '5,5';
    case 'dotted':
      return '1,3';
    case 'dashdot':
      return '5,3,1,3';
    default:
      return undefined;
  }
}

export function TimeSeriesChart({
  series,
  aggregationConfig,
  shadows = [],
  shadowsEnabled = true,
  averageShadows = false,
  shadowColor = '#9ca3af',
  shadowLineStyle = 'dashed',
  goals = [],
  forecastConfig,
  forecastSnapshot,
  focusPeriod,
  annotations = [],
  annotationsEnabled = false,
  metricAnnotations = [],
  width = 400,
  height = 500,
  onSeriesUpdate
}: TimeSeriesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [currentDomain, setCurrentDomain] = useState<[Date, Date] | null>(null);
  const [currentYDomain, setCurrentYDomain] = useState<[number, number] | null>(null);
  const [chartWidth, setChartWidth] = useState(width);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedName, setEditedName] = useState(series.metadata.name);
  const [editedDescription, setEditedDescription] = useState(series.metadata.description || '');
  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const goalsDataRef = useRef<Array<{ goal: Goal; data: Array<{ date: Date; value: number }> }>>([]);
  const [focusPeriodStats, setFocusPeriodStats] = useState<{
    mean: number;
    min: number;
    max: number;
    count: number;
    precision: number;
    label?: string;
    shadowMean?: number;
    shadowLabel?: string;
    goalMean?: number;
    goalLabel?: string;
    isForecast?: boolean;
    forecastCount?: number;
    actualCount?: number;
  } | null>(null);

  // Update chart width when container resizes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) {
          setChartWidth(newWidth);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Memoize aggregation calculations to avoid recalculating on every render
  const aggregatedDataMemo = useMemo(() => {
    if (!aggregationConfig?.enabled) return null;

    // Aggregate actual data only
    const aggregatedData = applyAggregation(series.data, aggregationConfig);

    const aggregatedDataWithValues = aggregatedData.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));

    // Aggregate forecast data separately
    const forecastAsTimeSeriesPoints: TimeSeriesPoint[] = forecastConfig?.enabled && forecastSnapshot
      ? forecastSnapshot.values.map(f => ({
          date: new Date(f.date),
          numerator: f.value,
          denominator: 1
        }))
      : [];

    const aggregatedForecastData = forecastAsTimeSeriesPoints.length > 0
      ? applyAggregation(forecastAsTimeSeriesPoints, aggregationConfig)
      : [];

    const aggregatedForecast = aggregatedForecastData.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));

    // Determine the actual forecast start date
    const forecastStartDate = forecastSnapshot && forecastSnapshot.values.length > 0
      ? new Date(forecastSnapshot.values[0].date)
      : null;

    // Show ALL actual data
    const aggregatedHistorical = aggregatedDataWithValues;

    return {
      aggregatedData,
      aggregatedDataWithValues,
      aggregatedHistorical,
      aggregatedForecast,
      forecastStartDate
    };
  }, [series.data, aggregationConfig, forecastConfig?.enabled, forecastSnapshot]);

  // Memoize shadow aggregation calculations
  const aggregatedShadowsDataMemo = useMemo(() => {
    if (!shadowsEnabled) return [];

    const shadowsData = generateShadowsData(series.data, shadows, undefined);

    if (!aggregationConfig?.enabled) {
      return shadowsData;
    }

    return shadowsData.map(sd => ({
      shadow: sd.shadow,
      data: applyAggregation(sd.data, aggregationConfig),
      color: sd.color
    }));
  }, [series.data, shadows, shadowsEnabled, aggregationConfig]);

  useEffect(() => {
    if (!svgRef.current || !series.data.length) return;

    // Clear previous content
    select(svgRef.current).selectAll('*').remove();

    // Set up margins
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = select(svgRef.current)
      .attr('width', chartWidth)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add clipping path to prevent lines from extending past chart boundaries
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Create a group for all chart elements that should be clipped
    const chartGroup = g
      .append('g')
      .attr('clip-path', 'url(#chart-clip)');

    // Calculate values (numerator / denominator)
    const dataWithValues = series.data.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));

    // Calculate the maximum precision from the raw data (capped at 2 decimal places)
    const dataPrecision = Math.min(2, Math.max(
      ...dataWithValues.slice(0, 100).map(d => getDecimalPrecision(d.value))
    ));

    // Use memoized aggregation data
    const aggregatedDataWithValues = aggregatedDataMemo?.aggregatedDataWithValues || [];
    const aggregatedHistorical = aggregatedDataMemo?.aggregatedHistorical || dataWithValues;
    const aggregatedForecast = aggregatedDataMemo?.aggregatedForecast ||
      (forecastSnapshot?.values.map(v => ({ date: new Date(v.date), value: v.value })) || []);

    // Create forecast result from snapshot
    const forecastResult = forecastConfig?.enabled && forecastSnapshot ? {
      forecast: aggregatedForecast,
      confidenceIntervals: forecastSnapshot.confidenceIntervals,
      parameters: forecastSnapshot.parameters,
      method: forecastSnapshot.method
    } : null;

    // Create scales - use aggregated historical data for domain if available
    const displayData = aggregatedHistorical;

    // Fill gaps with null values to create visual breaks in the line
    // Use displayData so gaps are detected in the currently displayed data (smoothed or raw)
    const dataWithGaps = fillGapsWithNulls(displayData);

    // Use memoized shadow aggregation data
    const aggregatedShadowsData = aggregatedShadowsDataMemo;

    // Convert shadow data to include calculated values for comparison
    const shadowsDataWithValues = aggregatedShadowsData.map(sd => ({
      shadow: sd.shadow,
      data: sd.data.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      })),
      color: sd.color
    }));

    // Calculate averaged shadow data if enabled (use aggregated data)
    const averagedShadowData = averageShadows && aggregatedShadowsData.length > 1
      ? calculateShadowAverage(aggregatedShadowsData)
      : [];

    // Get forecast end date if available
    const forecastEndDate = forecastResult && forecastResult.forecast.length > 0
      ? forecastResult.forecast[forecastResult.forecast.length - 1].date
      : undefined;

    // Generate goal data (continuous goals will extend through forecast period)
    const goalsData = generateGoalsData(series.data, goals, forecastEndDate);

    // Convert goal data to include calculated values for comparison
    const goalsDataWithValues = goalsData.map(gd => ({
      goal: gd.goal,
      data: gd.data.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      })),
      color: gd.color
    }));

    // Store goals data in ref for event handlers
    goalsDataRef.current = goalsDataWithValues;

    // Debug logging
    if (forecastConfig?.enabled) {
      console.log('Forecast config:', forecastConfig);
      console.log('Forecast result:', forecastResult);
      console.log('Data points:', dataWithValues.length);
    }

    // Calculate focus period statistics
    if (focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
      // Get actual data within focus period
      const focusData = displayData.filter(d =>
        d.date >= focusPeriod.startDate! && d.date <= focusPeriod.endDate!
      );

      // Get forecast data within focus period (if available)
      const focusForecastData = forecastResult?.forecast.filter(f =>
        f.date >= focusPeriod.startDate! && f.date <= focusPeriod.endDate!
      ) || [];

      // Combine actual and forecast data for statistics
      const allFocusData = [...focusData, ...focusForecastData.map(f => ({ date: f.date, value: f.value }))];

      if (allFocusData.length > 0) {
        const values = allFocusData.map(d => d.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        let min = Infinity;
        let max = -Infinity;
        for (const value of values) {
          if (value < min) min = value;
          if (value > max) max = value;
        }

        // Track if this includes forecast data
        const isForecast = focusForecastData.length > 0;
        const forecastCount = focusForecastData.length;
        const actualCount = focusData.length;

        // Calculate shadow mean over focus period
        let shadowMean: number | undefined;
        let shadowLabel: string | undefined;
        if (shadowsDataWithValues.length > 0 || (averageShadows && averagedShadowData.length > 0)) {
          const shadowValues: number[] = [];
          allFocusData.forEach(d => {
            const shadowVal = findShadowValue(d.date, shadowsDataWithValues, averagedShadowData, averageShadows);
            if (shadowVal !== undefined) {
              shadowValues.push(shadowVal);
            }
          });
          if (shadowValues.length > 0) {
            shadowMean = shadowValues.reduce((sum, v) => sum + v, 0) / shadowValues.length;
            shadowLabel = averageShadows && shadowsDataWithValues.length > 1
              ? getAveragedShadowLabel(shadows)
              : shadowsDataWithValues.length > 0
              ? shadowsDataWithValues[0].shadow.label
              : undefined;
          }
        }

        // Calculate goal mean over focus period
        let goalMean: number | undefined;
        let goalLabel: string | undefined;
        if (goalsDataWithValues.length > 0) {
          const goalValues: number[] = [];
          allFocusData.forEach(d => {
            const goalVal = findGoalValue(d.date, goalsDataWithValues, selectedGoalIndex);
            if (goalVal !== undefined) {
              goalValues.push(goalVal);
            }
          });
          if (goalValues.length > 0) {
            goalMean = goalValues.reduce((sum, v) => sum + v, 0) / goalValues.length;
            goalLabel = goalsDataWithValues[selectedGoalIndex]?.goal.label;
          }
        }

        setFocusPeriodStats({
          mean,
          min,
          max,
          count: allFocusData.length,
          precision: dataPrecision,
          label: focusPeriod.label,
          shadowMean,
          shadowLabel,
          goalMean,
          goalLabel,
          isForecast,
          forecastCount,
          actualCount
        });
      } else {
        setFocusPeriodStats(null);
      }
    } else {
      setFocusPeriodStats(null);
    }

    // Initialize hover data with most recent point if not already set
    if (!hoverData && displayData.length > 0) {
      const mostRecent = displayData[displayData.length - 1];

      // Find shadow value and label for comparison
      const shadowValue = findShadowValue(
        mostRecent.date,
        shadowsDataWithValues,
        averagedShadowData,
        averageShadows
      );
      const shadowLabel = averageShadows && shadowsDataWithValues.length > 1
        ? getAveragedShadowLabel(shadows)
        : shadowsDataWithValues.length > 0
        ? shadowsDataWithValues[0].shadow.label
        : undefined;

      // Find goal value and label for comparison
      const goalValue = findGoalValue(mostRecent.date, goalsDataWithValues, selectedGoalIndex);
      const goalLabel = goalsDataWithValues[selectedGoalIndex]?.goal.label;

      setHoverData({
        date: mostRecent.date.toLocaleDateString(),
        value: mostRecent.value,
        precision: dataPrecision,
        shadowValue,
        shadowLabel,
        goalValue,
        goalLabel
      });
    }

    // Get full extent and use current domain if zoomed
    // Include goal dates and forecast dates in the extent calculation
    let fullExtent = extent(dataWithValues, d => d.date) as [Date, Date];

    // Extend the extent if goals go beyond the data range
    goalsData.forEach(goalData => {
      if (goalData.data.length > 0) {
        const goalExtent = extent(goalData.data, d => d.date) as [Date, Date];
        if (goalExtent[0] < fullExtent[0]) fullExtent[0] = goalExtent[0];
        if (goalExtent[1] > fullExtent[1]) fullExtent[1] = goalExtent[1];
      }
    });

    // Extend the extent if forecast goes beyond the data range
    if (forecastResult && forecastResult.forecast.length > 0) {
      const forecastExtent = extent(forecastResult.forecast, d => d.date) as [Date, Date];
      if (forecastExtent[1] > fullExtent[1]) fullExtent[1] = forecastExtent[1];
    }

    // If we have a current domain (zoomed/panned), extend it to include forecast
    let initialDomain: [Date, Date];
    if (currentDomain) {
      initialDomain = [currentDomain[0], currentDomain[1]];
      // Extend the right side to include forecast if needed
      if (forecastResult && forecastResult.forecast.length > 0) {
        const forecastEnd = forecastResult.forecast[forecastResult.forecast.length - 1].date;
        if (forecastEnd > initialDomain[1]) {
          initialDomain[1] = forecastEnd;
        }
      }
    } else {
      initialDomain = fullExtent;
    }

    const xScale = scaleTime()
      .domain(initialDomain)
      .range([0, innerWidth]);

    // Use currentYDomain if zoomed, otherwise calculate from data and goals
    let yDomain: [number, number];
    if (currentYDomain) {
      yDomain = currentYDomain;
    } else {
      // Collect all values to find true min and max
      const allValues: number[] = [];

      // Add data values
      dataWithValues.forEach(d => {
        if (d.value != null && !isNaN(d.value) && isFinite(d.value)) {
          allValues.push(d.value);
        }
      });

      // Add goal values
      goalsDataWithValues.forEach(gd => {
        gd.data.forEach(d => {
          if (d.value != null && !isNaN(d.value) && isFinite(d.value)) {
            allValues.push(d.value);
          }
        });
      });

      // Add forecast values (including confidence intervals)
      if (forecastResult) {
        forecastResult.forecast.forEach(d => {
          if (d.value != null && !isNaN(d.value) && isFinite(d.value)) {
            allValues.push(d.value);
          }
        });

        // Include confidence intervals
        if (forecastResult.confidenceIntervals) {
          allValues.push(...forecastResult.confidenceIntervals.upper.filter(v => !isNaN(v) && isFinite(v)));
          allValues.push(...forecastResult.confidenceIntervals.lower.filter(v => !isNaN(v) && isFinite(v)));
        }
      }

      // Calculate min/max with 20% padding
      const minValue = min(allValues) as number;
      const maxValue = max(allValues) as number;
      const range = maxValue - minValue;
      const yMin = minValue - (range * 0.2);
      const yMax = maxValue + (range * 0.2);

      yDomain = [yMin, yMax];
    }

    const yScale = scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0]);

    // Create line generator
    const line = d3Line<{ date: Date; value: number | null }>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value as number))
      .defined(d => d.value != null && !isNaN(d.value) && isFinite(d.value))
      .curve(curveLinear);

    // Draw axes with custom formatting
    // Custom x-axis formatter that shows year when it changes
    let previousYear: number | null = null;
    const xAxis = axisBottom(xScale).tickFormat((domainValue) => {
      const date = domainValue as Date;
      const currentYear = date.getFullYear();
      const shouldShowYear = previousYear === null || currentYear !== previousYear;
      previousYear = currentYear;

      // Format: "Oct 27" or "Oct 27, 2024" (with year when it changes)
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();

      return shouldShowYear ? `${month} ${day}, ${currentYear}` : `${month} ${day}`;
    });

    const yAxis = axisLeft(yScale);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    // Draw focus period highlight (if enabled)
    if (focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
      const startX = xScale(focusPeriod.startDate);
      const endX = xScale(focusPeriod.endDate);

      chartGroup.append('rect')
        .attr('class', 'focus-period-highlight')
        .attr('x', startX)
        .attr('y', 0)
        .attr('width', endX - startX)
        .attr('height', innerHeight)
        .attr('fill', '#fbbf24')
        .attr('fill-opacity', 0.1)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.3);
    }

    // Draw annotations (if enabled)
    if (annotationsEnabled) {
      const allAnnotations = mergeAnnotations(annotations, metricAnnotations);
      const annotationData = generateAnnotationData(
        allAnnotations,
        currentDomain || fullExtent
      );

      // Draw range annotations first (as background with hover labels)
      annotationData
        .filter(ad => ad.annotation.type === 'range')
        .forEach(ad => {
          const annotation = ad.annotation;
          if (annotation.startDate && annotation.endDate) {
            const startX = xScale(annotation.startDate);
            const endX = xScale(annotation.endDate);

            // Create a group for the annotation
            const annotationGroup = chartGroup.append('g')
              .attr('class', `annotation-range-group-${annotation.id}`);

            // Draw the range rectangle
            const rangeRect = annotationGroup.append('rect')
              .attr('class', `annotation-range-${annotation.id}`)
              .attr('x', startX)
              .attr('y', 0)
              .attr('width', endX - startX)
              .attr('height', innerHeight)
              .attr('fill', ad.color)
              .attr('fill-opacity', annotation.opacity || 0.1)
              .attr('stroke', ad.color)
              .attr('stroke-width', 1)
              .attr('stroke-opacity', 0.3)
              .attr('cursor', 'help');

            // Prepare label positioned in center of range
            const labelX = startX + (endX - startX) / 2;
            const labelY = 20;
            const labelText = annotation.label;
            const labelWidth = labelText.length * 6.5;

            // Create label background (hidden initially)
            const labelBg = annotationGroup.append('rect')
              .attr('x', labelX - labelWidth / 2 - 2)
              .attr('y', labelY - 12)
              .attr('width', labelWidth + 4)
              .attr('height', 16)
              .attr('fill', 'white')
              .attr('fill-opacity', 0.95)
              .attr('stroke', ad.color)
              .attr('stroke-width', 1)
              .attr('rx', 3)
              .style('display', 'none');

            // Create label text (hidden initially)
            const labelTextElem = annotationGroup.append('text')
              .attr('x', labelX)
              .attr('y', labelY)
              .attr('text-anchor', 'middle')
              .attr('font-size', '12px')
              .attr('fill', ad.color)
              .attr('font-weight', 'bold')
              .text(annotation.label)
              .style('display', 'none');

            // Show label on mouseover
            rangeRect.on('mouseover', function() {
              labelBg.style('display', null);
              labelTextElem.style('display', null);
            });

            // Hide label on mouseout
            rangeRect.on('mouseout', function() {
              labelBg.style('display', 'none');
              labelTextElem.style('display', 'none');
            });

            // Add title for native tooltip
            rangeRect.append('title')
              .text(annotation.label + (annotation.description ? `\n${annotation.description}` : ''));
          }
        });

      // Draw event annotations (vertical lines only - interactive elements added later)
      annotationData
        .filter(ad => ad.annotation.type === 'event')
        .forEach(ad => {
          const annotation = ad.annotation;
          if (annotation.date) {
            const xPos = xScale(annotation.date);

            // Draw vertical line (visual element only)
            chartGroup.append('line')
              .attr('class', `annotation-event-line-${annotation.id}`)
              .attr('x1', xPos)
              .attr('x2', xPos)
              .attr('y1', 0)
              .attr('y2', innerHeight)
              .attr('stroke', ad.color)
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', annotation.style === 'dashed' ? '4,4' : '0')
              .attr('opacity', 0.7);
          }
        });

      // Draw point annotations (visual circles only - interactive elements added later)
      annotationData
        .filter(ad => ad.annotation.type === 'point')
        .forEach(ad => {
          const annotation = ad.annotation;
          if (annotation.date && annotation.value !== undefined) {
            const xPos = xScale(annotation.date);
            const yPos = yScale(annotation.value);

            // Draw circle marker (visual element only)
            chartGroup.append('circle')
              .attr('class', `annotation-point-circle-${annotation.id}`)
              .attr('cx', xPos)
              .attr('cy', yPos)
              .attr('r', 5)
              .attr('fill', ad.color)
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
              .attr('opacity', 0.9);
          }
        });
    }

    // Draw shadows or averaged shadow (drawn first so they appear behind main line)
    const shadowStrokeDashArray = getStrokeDashArray(shadowLineStyle);
    if (averageShadows && averagedShadowData.length > 0) {
      // Draw shaded area for standard deviation
      const area =
        d3Area<typeof averagedShadowData[0]>()
        .x(d => xScale(d.date))
        .y0(d => yScale(Math.max(0, d.mean - d.stdDev)))
        .y1(d => yScale(d.mean + d.stdDev))
        .defined(d => d.mean != null && d.stdDev != null && !isNaN(d.mean) && isFinite(d.mean) && !isNaN(d.stdDev) && isFinite(d.stdDev))
        .curve(curveLinear);

      chartGroup.append('path')
        .datum(averagedShadowData)
        .attr('class', 'shadow-std-area')
        .attr('fill', shadowColor)
        .attr('opacity', 0.3)
        .attr('d', area);

      // Draw mean line (half the width of main series line)
      const meanLine =
        d3Line<typeof averagedShadowData[0]>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.mean))
        .defined(d => d.mean != null && !isNaN(d.mean) && isFinite(d.mean))
        .curve(curveLinear);

      const meanPath = chartGroup.append('path')
        .datum(averagedShadowData)
        .attr('class', 'shadow-mean-line')
        .attr('fill', 'none')
        .attr('stroke', shadowColor)
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', meanLine);

      if (shadowStrokeDashArray) {
        meanPath.attr('stroke-dasharray', shadowStrokeDashArray);
      }
    } else {
      // Draw individual shadows with progressive saturation fade (Option 5)
      // Shadows are ordered newest first (index 0), so we apply progressive desaturation to older shadows
      const totalShadows = aggregatedShadowsData.length;
      const primaryBlue = '#2563eb'; // Primary series color

      // Draw in reverse order (oldest first, so they appear in back)
      const reversedShadows = [...aggregatedShadowsData].reverse();
      reversedShadows.forEach((shadowData, reversedIndex) => {
        // Calculate original index (0 = newest, higher = older)
        const originalIndex = totalShadows - 1 - reversedIndex;

        // Apply progressive desaturation:
        // - Newest shadow (index 0): 25% desaturated (75% saturation)
        // - Oldest shadow: 100% desaturated (fully gray)
        // - Linear progression for shadows in between
        const minDesaturation = 25;
        const maxDesaturation = 100;
        const desaturatePercent = totalShadows === 1
          ? minDesaturation
          : minDesaturation + (maxDesaturation - minDesaturation) * (originalIndex / (totalShadows - 1));

        const fadedColor = desaturateColor(primaryBlue, desaturatePercent);

        const shadowValues = shadowData.data
          .map(d => ({
            date: d.date,
            value: d.numerator / d.denominator
          }))
          .filter(d => !isNaN(d.value) && isFinite(d.value));

        if (shadowValues.length > 0) {
          const shadowPath = chartGroup.append('path')
            .datum(shadowValues)
            .attr('class', `shadow-line-${shadowData.shadow.id}`)
            .attr('fill', 'none')
            .attr('stroke', fadedColor)
            .attr('stroke-width', 1)
            .attr('opacity', 0.7)
            .attr('d', line);

          // Apply configurable line style
          if (shadowStrokeDashArray) {
            shadowPath.attr('stroke-dasharray', shadowStrokeDashArray);
          }
        }
      });
    }

    // Draw goals (after shadows, before primary series)
    goalsData.forEach(goalData => {
      const goalValues = goalData.data
        .map(d => ({
          date: d.date,
          value: d.numerator / d.denominator
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));

      if (goalValues.length > 0) {
        // Create line generator for goals
        const goalLine =
          d3Line<{ date: Date; value: number }>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.value))
          .defined(d => !isNaN(d.value) && isFinite(d.value))
          .curve(curveLinear);

        chartGroup.append('path')
          .datum(goalValues)
          .attr('class', `goal-line-${goalData.goal.id}`)
          .attr('fill', 'none')
          .attr('stroke', goalData.color)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5') // Dashed line
          .attr('opacity', 0.8)
          .attr('d', goalLine);

        // Add text label for the goal
        if (goalData.goal.type === 'continuous') {
          // For continuous goals, place label on the right side of y-axis (inside chart), above the line
          const yPosition = yScale(goalValues[0].value);
          chartGroup.append('text')
            .attr('class', `goal-label-${goalData.goal.id}`)
            .attr('x', 5)
            .attr('y', yPosition - 5)
            .attr('text-anchor', 'start')
            .attr('font-size', '10px')
            .attr('fill', goalData.color)
            .attr('font-weight', 'bold')
            .text(goalData.goal.label);
        } else if (goalData.goal.type === 'end-of-period') {
          // For end-of-period goals, place label above and to the left of the end point
          const lastPoint = goalValues[goalValues.length - 1];
          const xPosition = xScale(lastPoint.date);
          const yPosition = yScale(lastPoint.value);

          const labelWidth = goalData.goal.label.length * 6 + 4;

          // Add background rectangle for better visibility
          chartGroup.append('rect')
            .attr('class', `goal-label-bg-${goalData.goal.id}`)
            .attr('x', xPosition - labelWidth - 5)
            .attr('y', yPosition - 18)
            .attr('width', labelWidth)
            .attr('height', 14)
            .attr('fill', 'white')
            .attr('opacity', 0.8)
            .attr('rx', 2);

          chartGroup.append('text')
            .attr('class', `goal-label-${goalData.goal.id}`)
            .attr('x', xPosition - 7)
            .attr('y', yPosition - 8)
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('fill', goalData.color)
            .attr('font-weight', 'bold')
            .text(goalData.goal.label);
        }
      }
    });

    // If aggregation is enabled, draw original data as points
    if (aggregationConfig?.enabled && aggregatedDataWithValues.length > 0) {
      // Only render points within the visible date range for performance
      const visibleData = dataWithValues.filter(d => {
        const dateTime = d.date.getTime();
        return dateTime >= initialDomain[0].getTime() && dateTime <= initialDomain[1].getTime();
      });

      chartGroup.selectAll('.data-point')
        .data(visibleData)
        .join(
          enter => enter
            .append('circle')
            .attr('class', 'data-point')
            .attr('r', 3)
            .attr('fill', '#93c5fd')
            .attr('opacity', 0.6),
          update => update,
          exit => exit.remove()
        )
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.value));

      // Draw smoothed line with gaps
      chartGroup.append('path')
        .datum(dataWithGaps)
        .attr('class', 'smoothed-line')
        .attr('fill', 'none')
        .attr('stroke', '#2563eb')
        .attr('stroke-width', 2)
        .attr('d', line);
    } else {
      // Draw regular line (no smoothing) with gaps
      chartGroup.append('path')
        .datum(dataWithGaps)
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', '#2563eb')
        .attr('stroke-width', 2)
        .attr('d', line);
    }

    // Draw forecast if enabled
    if (forecastResult && forecastResult.forecast.length > 0) {
      console.log('Rendering forecast with', forecastResult.forecast.length, 'points');
      console.log('First forecast point:', forecastResult.forecast[0]);
      console.log('Last data point:', displayData[displayData.length - 1]);

      // Draw confidence intervals first (as filled area)
      if (forecastResult.confidenceIntervals) {
        const areaGenerator = d3Area<{ date: Date; upper: number; lower: number }>()
          .x(d => xScale(d.date))
          .y0(d => yScale(d.lower))
          .y1(d => yScale(d.upper));

        const ciData = forecastResult.forecast.map((fp, i) => ({
          date: fp.date,
          upper: forecastResult.confidenceIntervals!.upper[i],
          lower: forecastResult.confidenceIntervals!.lower[i]
        }));

        console.log('CI data sample:', ciData[0]);

        chartGroup.append('path')
          .datum(ciData)
          .attr('class', 'forecast-confidence')
          .attr('fill', '#93c5fd')
          .attr('fill-opacity', 0.3)
          .attr('d', areaGenerator);
      }

      // Create a line generator specifically for forecast (without null handling)
      const forecastLine =
        d3Line<{ date: Date; value: number }>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value))
        .curve(curveLinear);

      // Connect last data point to first forecast point with a thin line
      const lastDataPoint = displayData[displayData.length - 1];
      const firstForecastPoint = forecastResult.forecast[0];

      chartGroup.append('line')
        .attr('class', 'forecast-connector')
        .attr('x1', xScale(lastDataPoint.date))
        .attr('y1', yScale(lastDataPoint.value))
        .attr('x2', xScale(firstForecastPoint.date))
        .attr('y2', yScale(firstForecastPoint.value))
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.5);

      // Draw forecast line (dashed)
      const forecastPath = chartGroup.append('path')
        .datum(forecastResult.forecast)
        .attr('class', 'forecast-line')
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('d', forecastLine);

      console.log('Forecast path d attribute:', forecastPath.attr('d'));
    }

    // Create hover line and circle in main group (not clipped)
    const hoverLine = g
      .append('line')
      .attr('class', 'hover-line')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    const hoverCircle = g
      .append('circle')
      .attr('class', 'hover-circle')
      .attr('r', 5)
      .attr('fill', '#2563eb')
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Create hover circle for raw data point (when aggregation is enabled)
    const hoverCircleRaw = g
      .append('circle')
      .attr('class', 'hover-circle-raw')
      .attr('r', 5)
      .attr('fill', '#93c5fd')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Create hover circle for shadow
    const hoverCircleShadow = g
      .append('circle')
      .attr('class', 'hover-circle-shadow')
      .attr('r', 4)
      .attr('fill', '#6b7280')
      .attr('stroke', '#374151')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Create hover circle for goal
    const hoverCircleGoal = g
      .append('circle')
      .attr('class', 'hover-circle-goal')
      .attr('r', 4)
      .attr('fill', '#f97316') // Default orange-500
      .attr('stroke', '#ea580c') // Darker orange-600
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Create hover circle for forecast
    const hoverCircleForecast = g
      .append('circle')
      .attr('class', 'hover-circle-forecast')
      .attr('r', 4)
      .attr('fill', '#3b82f6') // Blue-500 to match forecast line
      .attr('stroke', '#2563eb') // Blue-600
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '2,2') // Dashed stroke to match forecast line style
      .style('opacity', 0);

    // Create background rectangles and text labels for each circle
    const hoverTextBgMain = g
      .append('rect')
      .attr('class', 'hover-text-bg-main')
      .attr('fill', 'white')
      .attr('fill-opacity', 0.85)
      .attr('rx', 2)
      .style('opacity', 0);

    const hoverTextMain = g
      .append('text')
      .attr('class', 'hover-text-main')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#2563eb')
      .attr('text-anchor', 'start')
      .style('opacity', 0);

    const hoverTextBgRaw = g
      .append('rect')
      .attr('class', 'hover-text-bg-raw')
      .attr('fill', 'white')
      .attr('fill-opacity', 0.85)
      .attr('rx', 2)
      .style('opacity', 0);

    const hoverTextRaw = g
      .append('text')
      .attr('class', 'hover-text-raw')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#3b82f6')
      .attr('text-anchor', 'start')
      .style('opacity', 0);

    const hoverTextBgShadow = g
      .append('rect')
      .attr('class', 'hover-text-bg-shadow')
      .attr('fill', 'white')
      .attr('fill-opacity', 0.85)
      .attr('rx', 2)
      .style('opacity', 0);

    const hoverTextShadow = g
      .append('text')
      .attr('class', 'hover-text-shadow')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .attr('text-anchor', 'start')
      .style('opacity', 0);

    const hoverTextBgGoal = g
      .append('rect')
      .attr('class', 'hover-text-bg-goal')
      .attr('fill', 'white')
      .attr('fill-opacity', 0.85)
      .attr('rx', 2)
      .style('opacity', 0);

    const hoverTextGoal = g
      .append('text')
      .attr('class', 'hover-text-goal')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ea580c')
      .attr('text-anchor', 'start')
      .style('opacity', 0);

    const hoverTextBgForecast = g
      .append('rect')
      .attr('class', 'hover-text-bg-forecast')
      .attr('fill', 'white')
      .attr('fill-opacity', 0.85)
      .attr('rx', 2)
      .style('opacity', 0);

    const hoverTextForecast = g
      .append('text')
      .attr('class', 'hover-text-forecast')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#2563eb') // Blue-600 to match forecast circle
      .attr('text-anchor', 'start')
      .style('opacity', 0);

    // Create overlay for hover interactions - on top of everything
    const overlay = g
      .append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair');

    // Bisector for finding closest data point (including gaps)
    const bisect = bisector<{ date: Date; value: number | null }, Date>(d => d.date).left;

    // Mouse move handler
    overlay.on('mousemove', function(event) {
      const [mouseX] = pointer(event);
      const hoveredDate = xScale.invert(mouseX);

      // Always show the vertical line at mouse position
      hoverLine
        .attr('x1', mouseX)
        .attr('x2', mouseX)
        .style('opacity', 1);

      // Check if we're hovering over the forecast period
      const lastDataDate = displayData[displayData.length - 1]?.date;
      const isForecastPeriod = forecastResult && lastDataDate && hoveredDate > lastDataDate;

      if (isForecastPeriod && forecastResult) {
        // Find closest forecast point
        const forecastBisect = bisector<{ date: Date; value: number }, Date>(d => d.date).left;
        const forecastIndex = forecastBisect(forecastResult.forecast, hoveredDate, 1);
        const f0 = forecastResult.forecast[forecastIndex - 1];
        const f1 = forecastResult.forecast[forecastIndex];

        const closestForecast = !f1 ? f0 : !f0 ? f1 :
          hoveredDate.getTime() - f0.date.getTime() > f1.date.getTime() - hoveredDate.getTime() ? f1 : f0;

        if (closestForecast) {
          const x = xScale(closestForecast.date);
          const y = yScale(closestForecast.value);

          hoverCircle
            .attr('cx', x)
            .attr('cy', y)
            .style('opacity', 1);

          // Show main text label with background
          const mainText = formatWithPrecision(closestForecast.value, dataPrecision);
          const mainTextWidth = mainText.length * 6 + 4; // Approximate width
          hoverTextBgMain
            .attr('x', x + 5)
            .attr('y', y - 16)
            .attr('width', mainTextWidth)
            .attr('height', 12)
            .style('opacity', 1);
          hoverTextMain
            .attr('x', x + 6)
            .attr('y', y - 6)
            .text(mainText)
            .style('opacity', 1);

          hoverCircleRaw.style('opacity', 0);
          hoverTextRaw.style('opacity', 0);
          hoverTextBgRaw.style('opacity', 0);

          // Show forecast circle
          hoverCircleForecast
            .attr('cx', x)
            .attr('cy', y)
            .style('opacity', 1);

          // Get the last actual value for comparison
          const lastActualValue = displayData[displayData.length - 1].value;

          // Find shadow value and label for comparison (for the forecast date)
          const shadowValue = findShadowValue(
            closestForecast.date,
            shadowsDataWithValues,
            averagedShadowData,
            averageShadows
          );
          const shadowLabel = averageShadows && shadowsDataWithValues.length > 1
            ? getAveragedShadowLabel(shadows)
            : shadowsDataWithValues.length > 0
            ? shadowsDataWithValues[0].shadow.label
            : undefined;

          // Find goal value and label for comparison (for the forecast date)
          const goalValue = findGoalValue(closestForecast.date, goalsDataWithValues, selectedGoalIndex);
          const goalLabel = goalsDataWithValues[selectedGoalIndex]?.goal.label;

          // Position shadow circle and text with background
          if (shadowValue !== undefined) {
            const shadowY = yScale(shadowValue);
            const shadowText = formatWithPrecision(shadowValue, dataPrecision);
            const shadowTextWidth = shadowText.length * 6 + 4;
            hoverCircleShadow
              .attr('cx', x)
              .attr('cy', shadowY)
              .style('opacity', 1);
            hoverTextBgShadow
              .attr('x', x + 5)
              .attr('y', shadowY - 16)
              .attr('width', shadowTextWidth)
              .attr('height', 12)
              .style('opacity', 1);
            hoverTextShadow
              .attr('x', x + 6)
              .attr('y', shadowY - 6)
              .text(shadowText)
              .style('opacity', 1);
          } else {
            hoverCircleShadow.style('opacity', 0);
            hoverTextShadow.style('opacity', 0);
            hoverTextBgShadow.style('opacity', 0);
          }

          // Position goal circle and text with background
          if (goalValue !== undefined && goalsDataWithValues[selectedGoalIndex]) {
            const goalColor = goalsDataWithValues[selectedGoalIndex].color;
            const goalY = yScale(goalValue);
            const goalText = formatWithPrecision(goalValue, dataPrecision);
            const goalTextWidth = goalText.length * 6 + 4;
            hoverCircleGoal
              .attr('cx', x)
              .attr('cy', goalY)
              .attr('fill', goalColor)
              .attr('stroke', goalColor)
              .style('opacity', 1);
            hoverTextBgGoal
              .attr('x', x + 5)
              .attr('y', goalY - 16)
              .attr('width', goalTextWidth)
              .attr('height', 12)
              .style('opacity', 1);
            hoverTextGoal
              .attr('x', x + 6)
              .attr('y', goalY - 6)
              .attr('fill', goalColor)
              .text(goalText)
              .style('opacity', 1);
          } else {
            hoverCircleGoal.style('opacity', 0);
            hoverTextGoal.style('opacity', 0);
            hoverTextBgGoal.style('opacity', 0);
          }

          setHoverData({
            date: closestForecast.date.toLocaleDateString(),
            value: closestForecast.value,
            precision: dataPrecision,
            forecastValue: closestForecast.value,
            isForecast: true,
            rawValue: lastActualValue, // Use last actual value as reference
            shadowValue,
            shadowLabel,
            goalValue,
            goalLabel
          });
        }
      } else {
        // Original logic for hovering over actual data
        // Search within dataWithGaps to find if we're in a gap
        const index = bisect(dataWithGaps, hoveredDate, 1);
        const d0 = dataWithGaps[index - 1];
        const d1 = dataWithGaps[index];

        // Find closest point in dataWithGaps (which includes null points for gaps)
        const d = !d1 ? d0 : !d0 ? d1 :
          hoveredDate.getTime() - d0.date.getTime() > d1.date.getTime() - hoveredDate.getTime() ? d1 : d0;

        // Check if we're hovering over a real data point or a gap
        const hasValue = d && d.value != null && !isNaN(d.value);

        if (hasValue) {
        const x = xScale(d.date);
        const y = yScale(d.value as number);

        hoverCircle
          .attr('cx', x)
          .attr('cy', y)
          .style('opacity', 1);

        // Show main text label with background
        const mainText = formatWithPrecision(d.value as number, dataPrecision);
        const mainTextWidth = mainText.length * 6 + 4;
        hoverTextBgMain
          .attr('x', x + 5)
          .attr('y', y - 16)
          .attr('width', mainTextWidth)
          .attr('height', 12)
          .style('opacity', 1);
        hoverTextMain
          .attr('x', x + 6)
          .attr('y', y - 6)
          .text(mainText)
          .style('opacity', 1);

        // If aggregation is enabled, find and highlight the raw data point
        let rawValue: number | undefined;
        if (aggregationConfig?.enabled && dataWithValues.length > 0) {
          const rawPoint = dataWithValues.find(p => p.date.getTime() === d.date.getTime());
          if (rawPoint) {
            rawValue = rawPoint.value;
            const rawY = yScale(rawPoint.value);
            const rawText = formatWithPrecision(rawPoint.value, dataPrecision);
            const rawTextWidth = rawText.length * 6 + 4;
            hoverCircleRaw
              .attr('cx', x)
              .attr('cy', rawY)
              .style('opacity', 1);
            hoverTextBgRaw
              .attr('x', x + 5)
              .attr('y', rawY - 16)
              .attr('width', rawTextWidth)
              .attr('height', 12)
              .style('opacity', 1);
            hoverTextRaw
              .attr('x', x + 6)
              .attr('y', rawY - 6)
              .text(rawText)
              .style('opacity', 1);
          } else {
            hoverCircleRaw.style('opacity', 0);
            hoverTextRaw.style('opacity', 0);
            hoverTextBgRaw.style('opacity', 0);
          }
        } else {
          hoverCircleRaw.style('opacity', 0);
          hoverTextRaw.style('opacity', 0);
          hoverTextBgRaw.style('opacity', 0);
        }

        // Find shadow value and label for comparison
        const shadowValue = findShadowValue(
          d.date,
          shadowsDataWithValues,
          averagedShadowData,
          averageShadows
        );
        const shadowLabel = averageShadows && shadowsDataWithValues.length > 1
          ? getAveragedShadowLabel(shadows)
          : shadowsDataWithValues.length > 0
          ? shadowsDataWithValues[0].shadow.label
          : undefined;

        // Find goal value and label for comparison
        const goalValue = findGoalValue(d.date, goalsDataWithValues, selectedGoalIndex);
        const goalLabel = goalsDataWithValues[selectedGoalIndex]?.goal.label;

        // Find forecast value if exists at this date
        let forecastValueAtDate: number | undefined;
        if (forecastResult && forecastResult.forecast.length > 0) {
          const forecastPoint = forecastResult.forecast.find(f => {
            const diff = Math.abs(f.date.getTime() - d.date.getTime());
            return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
          });
          forecastValueAtDate = forecastPoint?.value;
        }

        // Position shadow circle and text with background
        if (shadowValue !== undefined) {
          const shadowY = yScale(shadowValue);
          const shadowText = formatWithPrecision(shadowValue, dataPrecision);
          const shadowTextWidth = shadowText.length * 6 + 4;
          hoverCircleShadow
            .attr('cx', x)
            .attr('cy', shadowY)
            .style('opacity', 1);
          hoverTextBgShadow
            .attr('x', x + 5)
            .attr('y', shadowY - 16)
            .attr('width', shadowTextWidth)
            .attr('height', 12)
            .style('opacity', 1);
          hoverTextShadow
            .attr('x', x + 6)
            .attr('y', shadowY - 6)
            .text(shadowText)
            .style('opacity', 1);
        } else {
          hoverCircleShadow.style('opacity', 0);
          hoverTextShadow.style('opacity', 0);
          hoverTextBgShadow.style('opacity', 0);
        }

        // Position goal circle and text with background
        if (goalValue !== undefined && goalsDataWithValues[selectedGoalIndex]) {
          const goalColor = goalsDataWithValues[selectedGoalIndex].color;
          const goalY = yScale(goalValue);
          const goalText = formatWithPrecision(goalValue, dataPrecision);
          const goalTextWidth = goalText.length * 6 + 4;
          hoverCircleGoal
            .attr('cx', x)
            .attr('cy', goalY)
            .attr('fill', goalColor)
            .attr('stroke', goalColor)
            .style('opacity', 1);
          hoverTextBgGoal
            .attr('x', x + 5)
            .attr('y', goalY - 16)
            .attr('width', goalTextWidth)
            .attr('height', 12)
            .style('opacity', 1);
          hoverTextGoal
            .attr('x', x + 6)
            .attr('y', goalY - 6)
            .attr('fill', goalColor)
            .text(goalText)
            .style('opacity', 1);
        } else {
          hoverCircleGoal.style('opacity', 0);
          hoverTextGoal.style('opacity', 0);
          hoverTextBgGoal.style('opacity', 0);
        }

        // Show forecast circle, text, and background if forecast exists at this date
        if (forecastValueAtDate !== undefined) {
          const forecastY = yScale(forecastValueAtDate);
          const forecastText = formatWithPrecision(forecastValueAtDate, dataPrecision);
          const forecastTextWidth = forecastText.length * 6 + 4;
          hoverCircleForecast
            .attr('cx', x)
            .attr('cy', forecastY)
            .style('opacity', 1);
          hoverTextBgForecast
            .attr('x', x + 5)
            .attr('y', forecastY - 16)
            .attr('width', forecastTextWidth)
            .attr('height', 12)
            .style('opacity', 1);
          hoverTextForecast
            .attr('x', x + 6)
            .attr('y', forecastY - 6)
            .text(forecastText)
            .style('opacity', 1);
        } else {
          hoverCircleForecast.style('opacity', 0);
          hoverTextForecast.style('opacity', 0);
          hoverTextBgForecast.style('opacity', 0);
        }

        setHoverData({
          date: d.date.toLocaleDateString(),
          value: d.value as number,
          rawValue,
          precision: dataPrecision,
          shadowValue,
          shadowLabel,
          goalValue,
          goalLabel,
          forecastValue: forecastValueAtDate,
          isForecast: false
        });
      } else {
        // Hovering over a gap - hide circles, text, and backgrounds but show date
        hoverCircle.style('opacity', 0);
        hoverCircleRaw.style('opacity', 0);
        hoverCircleShadow.style('opacity', 0);
        hoverCircleGoal.style('opacity', 0);
        hoverCircleForecast.style('opacity', 0);
        hoverTextMain.style('opacity', 0);
        hoverTextRaw.style('opacity', 0);
        hoverTextShadow.style('opacity', 0);
        hoverTextGoal.style('opacity', 0);
        hoverTextForecast.style('opacity', 0);
        hoverTextBgMain.style('opacity', 0);
        hoverTextBgRaw.style('opacity', 0);
        hoverTextBgShadow.style('opacity', 0);
        hoverTextBgGoal.style('opacity', 0);
        hoverTextBgForecast.style('opacity', 0);

        // Show the date we're hovering over even if there's no data
        setHoverData({
          date: hoveredDate.toLocaleDateString(),
          value: NaN, // Use NaN to indicate no data
          precision: dataPrecision,
          isForecast: false
        });
        }
      }
    });

    overlay.on('mouseout', function() {
      hoverLine.style('opacity', 0);
      hoverCircle.style('opacity', 0);
      hoverCircleRaw.style('opacity', 0);
      hoverCircleShadow.style('opacity', 0);
      hoverCircleGoal.style('opacity', 0);
      hoverCircleForecast.style('opacity', 0);
      hoverTextMain.style('opacity', 0);
      hoverTextRaw.style('opacity', 0);
      hoverTextShadow.style('opacity', 0);
      hoverTextGoal.style('opacity', 0);
      hoverTextForecast.style('opacity', 0);
      hoverTextBgMain.style('opacity', 0);
      hoverTextBgRaw.style('opacity', 0);
      hoverTextBgShadow.style('opacity', 0);
      hoverTextBgGoal.style('opacity', 0);
      hoverTextBgForecast.style('opacity', 0);
      // Set to most recent data point instead of null
      const mostRecent = displayData[displayData.length - 1];
      if (mostRecent) {
        // If smoothing is enabled, find the raw data point for the most recent date
        let rawValue: number | undefined;
        if (aggregationConfig?.enabled && dataWithValues.length > 0) {
          const rawPoint = dataWithValues.find(p => p.date.getTime() === mostRecent.date.getTime());
          rawValue = rawPoint?.value;
        }

        // Find shadow value and label for comparison
        const shadowValue = findShadowValue(
          mostRecent.date,
          shadowsDataWithValues,
          averagedShadowData,
          averageShadows
        );
        const shadowLabel = averageShadows && shadowsDataWithValues.length > 1
          ? getAveragedShadowLabel(shadows)
          : shadowsDataWithValues.length > 0
          ? shadowsDataWithValues[0].shadow.label
          : undefined;

        // Find goal value and label for comparison
        const goalValue = findGoalValue(mostRecent.date, goalsDataWithValues, selectedGoalIndex);
        const goalLabel = goalsDataWithValues[selectedGoalIndex]?.goal.label;

        setHoverData({
          date: mostRecent.date.toLocaleDateString(),
          value: mostRecent.value,
          rawValue,
          precision: dataPrecision,
          shadowValue,
          shadowLabel,
          goalValue,
          goalLabel
        });
      }
    });

    // Add brush for click-drag zoom selection (2D)
    const brush = d3Brush()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .filter(function(event) {
        // Don't allow brush when shift key is held
        return !event.shiftKey;
      })
      .on('start', function() {
        // Disable hover interactions while brushing
        overlay.style('pointer-events', 'none');
      })
      .on('end', function(event) {
        // Re-enable hover interactions
        overlay.style('pointer-events', 'all');

        if (!event.selection) return;

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];

        // Calculate new x domain
        const newXDomain = [xScale.invert(x0), xScale.invert(x1)] as [Date, Date];

        // Calculate new y domain (inverted because y scale goes from bottom to top)
        const newYDomain = [yScale.invert(y1), yScale.invert(y0)] as [number, number];

        // Remove brush selection
        brushGroup.call(brush.move as any, null);

        // Update domains
        xScale.domain(newXDomain);
        yScale.domain(newYDomain);
        setCurrentDomain(newXDomain);
        setCurrentYDomain(newYDomain);

        updateChart();
      });

    const brushGroup = g.append('g')
      .attr('class', 'brush')
      .call(brush)
      .on('mousemove', function(event) {
        // Forward mousemove events to overlay when not brushing
        if (!event.buttons) {
          const overlayEvent = new MouseEvent('mousemove', {
            bubbles: true,
            clientX: event.clientX,
            clientY: event.clientY
          });
          overlay.node()?.dispatchEvent(overlayEvent);
        }
      });

    // Alt + click + drag for panning (both x and y axes)
    svg.on('mousedown', function(event) {
      if (!event.altKey) return;

      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      const startXDomain = xScale.domain() as [Date, Date];
      const startXDomainMs = [startXDomain[0].getTime(), startXDomain[1].getTime()];
      const xDomainRange = startXDomainMs[1] - startXDomainMs[0];

      const startYDomain = yScale.domain() as [number, number];
      const yDomainRange = startYDomain[1] - startYDomain[0];

      // Get the full y extent for clamping
      const fullYExtent = [0, max(dataWithValues, d => d.value) as number * 1.1];

      function onMouseMove(e: MouseEvent) {
        // Stop panning if alt key is released or mouse button released
        if (!e.altKey || e.buttons === 0) {
          cleanup();
          return;
        }

        // Calculate horizontal pan
        const dx = e.clientX - startX;
        const dxScale = (dx / innerWidth) * xDomainRange;

        const newXDomain = [
          new Date(startXDomainMs[0] - dxScale),
          new Date(startXDomainMs[1] - dxScale)
        ] as [Date, Date];

        // Clamp to full x extent
        if (newXDomain[0] < fullExtent[0]) {
          const shift = fullExtent[0].getTime() - newXDomain[0].getTime();
          newXDomain[0] = fullExtent[0];
          newXDomain[1] = new Date(newXDomain[1].getTime() + shift);
        }
        if (newXDomain[1] > fullExtent[1]) {
          const shift = newXDomain[1].getTime() - fullExtent[1].getTime();
          newXDomain[1] = fullExtent[1];
          newXDomain[0] = new Date(newXDomain[0].getTime() - shift);
        }

        // Calculate vertical pan (inverted because SVG y goes down)
        const dy = e.clientY - startY;
        const dyScale = (dy / innerHeight) * yDomainRange;

        const newYDomain = [
          startYDomain[0] + dyScale,
          startYDomain[1] + dyScale
        ] as [number, number];

        // Clamp to full y extent
        if (newYDomain[0] < fullYExtent[0]) {
          const shift = fullYExtent[0] - newYDomain[0];
          newYDomain[0] = fullYExtent[0];
          newYDomain[1] = newYDomain[1] + shift;
        }
        if (newYDomain[1] > fullYExtent[1]) {
          const shift = newYDomain[1] - fullYExtent[1];
          newYDomain[1] = fullYExtent[1];
          newYDomain[0] = newYDomain[0] - shift;
        }

        xScale.domain(newXDomain);
        yScale.domain(newYDomain);
        setCurrentDomain(newXDomain);
        setCurrentYDomain(newYDomain);
        updateChart();
      }

      function cleanup() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', cleanup);
        document.removeEventListener('keyup', onKeyUp);
      }

      function onKeyUp(e: KeyboardEvent) {
        // Stop panning when shift is released
        if (e.key === 'Shift') {
          cleanup();
        }
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', cleanup);
      document.addEventListener('keyup', onKeyUp);
    });

    // Double-click to reset zoom
    svg.on('dblclick', function() {
      setCurrentDomain(null);
      setCurrentYDomain(null);
      xScale.domain(fullExtent);

      // Recalculate y domain with 20% padding
      const allValues: number[] = dataWithValues
        .filter(d => d.value != null && !isNaN(d.value) && isFinite(d.value))
        .map(d => d.value);
      const minValue = min(allValues) as number;
      const maxValue = max(allValues) as number;
      const range = maxValue - minValue;
      const yMin = minValue - (range * 0.2);
      const yMax = maxValue + (range * 0.2);

      yScale.domain([yMin, yMax]);
      updateChart();
    });

    // Wheel/trackpad pinch zoom
    svg.on('wheel', function(event) {
      event.preventDefault();

      // Get mouse position relative to the chart
      const [mouseX, mouseY] = pointer(event);

      // Adjust mouseX and mouseY to be relative to the chart area
      const chartMouseX = mouseX - margin.left;
      const chartMouseY = mouseY - margin.top;

      // Only zoom if mouse is within chart bounds
      if (chartMouseX < 0 || chartMouseX > innerWidth || chartMouseY < 0 || chartMouseY > innerHeight) {
        return;
      }

      // Determine zoom factor
      // For trackpad pinch: event.ctrlKey is true and deltaY represents pinch amount
      // For mouse wheel: event.ctrlKey is false and deltaY represents scroll amount
      const zoomIntensity = 0.002;
      const delta = event.deltaY * zoomIntensity; // Reversed: positive deltaY = zoom out
      const zoomFactor = Math.exp(delta);

      // Get current domains
      const currentXDomain = xScale.domain() as [Date, Date];
      const currentYDomain = yScale.domain() as [number, number];

      // Get mouse position in data coordinates
      const mouseDate = xScale.invert(chartMouseX);
      const mouseValue = yScale.invert(chartMouseY);

      // Calculate new X domain centered on mouse position
      const xDomainMs = [currentXDomain[0].getTime(), currentXDomain[1].getTime()];
      const mouseDateMs = mouseDate.getTime();
      const xLeftDistance = mouseDateMs - xDomainMs[0];
      const xRightDistance = xDomainMs[1] - mouseDateMs;
      const newXLeftMs = mouseDateMs - xLeftDistance * zoomFactor;
      const newXRightMs = mouseDateMs + xRightDistance * zoomFactor;

      // Clamp X domain to data extent
      const clampedXLeftMs = Math.max(fullExtent[0].getTime(), newXLeftMs);
      const clampedXRightMs = Math.min(fullExtent[1].getTime(), newXRightMs);
      const newXDomain = [new Date(clampedXLeftMs), new Date(clampedXRightMs)] as [Date, Date];

      // Calculate new Y domain centered on mouse position
      const yTopDistance = currentYDomain[1] - mouseValue;
      const yBottomDistance = mouseValue - currentYDomain[0];
      const newYTop = mouseValue + yTopDistance * zoomFactor;
      const newYBottom = mouseValue - yBottomDistance * zoomFactor;

      // Clamp Y domain to data extent
      const fullYExtent = [0, max(dataWithValues, d => d.value) as number * 1.1];
      const clampedYBottom = Math.max(fullYExtent[0], newYBottom);
      const clampedYTop = Math.min(fullYExtent[1], newYTop);
      const newYDomain = [clampedYBottom, clampedYTop] as [number, number];

      // Update scales and state
      xScale.domain(newXDomain);
      yScale.domain(newYDomain);
      setCurrentDomain(newXDomain);
      setCurrentYDomain(newYDomain);

      updateChart();
    });

    // Function to update chart elements after zoom/pan
    function updateChart() {
      // Reset year tracker for axis formatting
      previousYear = null;

      // Update axes
      g.select('.x-axis')
        .call(xAxis as any);

      g.select('.y-axis')
        .call(yAxis as any);

      // Update lines
      g.selectAll('.line, .smoothed-line')
        .attr('d', line as any);

      // Update shadows
      g.selectAll('[class^="shadow-line-"]')
        .attr('d', line as any);

      // Update goals
      g.selectAll('[class^="goal-line-"]')
        .attr('d', (d: any) => {
          const goalLine =
            d3Line<{ date: Date; value: number }>()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .defined(d => !isNaN(d.value) && isFinite(d.value))
            .curve(curveLinear);
          return goalLine(d);
        });

      // Update goal labels
      goalsData.forEach(goalData => {
        const goalValues = goalData.data
          .map(d => ({
            date: d.date,
            value: d.numerator / d.denominator
          }))
          .filter(d => !isNaN(d.value) && isFinite(d.value));

        if (goalValues.length > 0) {
          if (goalData.goal.type === 'continuous') {
            const yPosition = yScale(goalValues[0].value);
            chartGroup.select(`.goal-label-${goalData.goal.id}`)
              .attr('y', yPosition - 5);
          } else if (goalData.goal.type === 'end-of-period') {
            const lastPoint = goalValues[goalValues.length - 1];
            const xPosition = xScale(lastPoint.date);
            const yPosition = yScale(lastPoint.value);
            chartGroup.select(`.goal-label-bg-${goalData.goal.id}`)
              .attr('x', xPosition + 5)
              .attr('y', yPosition - 18);
            chartGroup.select(`.goal-label-${goalData.goal.id}`)
              .attr('x', xPosition + 7)
              .attr('y', yPosition - 8);
          }
        }
      });

      // Update averaged shadow if present
      if (averageShadows && averagedShadowData.length > 0) {
        const area =
          d3Area<typeof averagedShadowData[0]>()
          .x(d => xScale(d.date))
          .y0(d => yScale(Math.max(0, d.mean - d.stdDev)))
          .y1(d => yScale(d.mean + d.stdDev))
          .defined(d => d.mean != null && d.stdDev != null && !isNaN(d.mean) && isFinite(d.mean) && !isNaN(d.stdDev) && isFinite(d.stdDev))
          .curve(curveLinear);

        const meanLine =
          d3Line<typeof averagedShadowData[0]>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.mean))
          .defined(d => d.mean != null && !isNaN(d.mean) && isFinite(d.mean))
          .curve(curveLinear);

        g.select('.shadow-std-area')
          .attr('d', area as any);

        g.select('.shadow-mean-line')
          .attr('d', meanLine as any);
      }

      // Update points - filter to only visible data for performance
      if (aggregationConfig?.enabled) {
        const currentDomain = xScale.domain() as [Date, Date];
        const visibleData = dataWithValues.filter(d => {
          const dateTime = d.date.getTime();
          return dateTime >= currentDomain[0].getTime() && dateTime <= currentDomain[1].getTime();
        });

        chartGroup.selectAll('.data-point')
          .data(visibleData, (d: any) => d.date.getTime())
          .join(
            enter => enter
              .append('circle')
              .attr('class', 'data-point')
              .attr('r', 3)
              .attr('fill', '#93c5fd')
              .attr('opacity', 0.6),
            update => update,
            exit => exit.remove()
          )
          .attr('cx', d => xScale(d.date))
          .attr('cy', d => yScale(d.value));
      }
    }

    // Add annotation interactive elements on top of overlay
    if (annotationsEnabled) {
      const allAnnotations = mergeAnnotations(annotations, metricAnnotations);
      const annotationData = generateAnnotationData(allAnnotations, currentDomain || undefined);

      // Add interactive elements for event annotations
      annotationData
        .filter(ad => ad.annotation.type === 'event')
        .forEach(ad => {
          const annotation = ad.annotation;
          if (annotation.date) {
            const xPos = xScale(annotation.date);

            // Create a group for interactive elements (on top of overlay)
            const interactiveGroup = g.append('g')
              .attr('class', `annotation-event-interactive-${annotation.id}`);

            // Add a small circle at the top for easier hover targeting
            const topCircle = interactiveGroup.append('circle')
              .attr('cx', xPos)
              .attr('cy', 5)
              .attr('r', 4)
              .attr('fill', ad.color)
              .attr('stroke', 'white')
              .attr('stroke-width', 1.5)
              .attr('cursor', 'help')
              .attr('pointer-events', 'all');

            // Invisible wider line for easier mouse targeting
            const hitArea = interactiveGroup.append('line')
              .attr('x1', xPos)
              .attr('x2', xPos)
              .attr('y1', 0)
              .attr('y2', innerHeight)
              .attr('stroke', 'transparent')
              .attr('stroke-width', 15)
              .attr('cursor', 'help')
              .attr('pointer-events', 'all');

            // Prepare label (full text, no truncation)
            const yPos = annotation.position === 'bottom' ? innerHeight - 5 : 15;
            const labelText = annotation.label;
            const labelWidth = Math.max(labelText.length * 7, 50);

            // Create label background (hidden initially)
            const labelBg = interactiveGroup.append('rect')
              .attr('x', xPos + 2)
              .attr('y', yPos - 12)
              .attr('width', labelWidth + 4)
              .attr('height', 16)
              .attr('fill', 'white')
              .attr('fill-opacity', 0.95)
              .attr('stroke', ad.color)
              .attr('stroke-width', 1)
              .attr('rx', 3)
              .attr('pointer-events', 'none')
              .style('display', 'none');

            // Create label text (hidden initially)
            const labelTextElem = interactiveGroup.append('text')
              .attr('x', xPos + 4)
              .attr('y', yPos)
              .attr('text-anchor', 'start')
              .attr('font-size', '12px')
              .attr('fill', ad.color)
              .attr('font-weight', 'bold')
              .attr('pointer-events', 'none')
              .text(labelText)
              .style('display', 'none');

            // Show label on mouseover (for both circle and hit area)
            const showLabel = function() {
              labelBg.style('display', null);
              labelTextElem.style('display', null);
            };
            const hideLabel = function() {
              labelBg.style('display', 'none');
              labelTextElem.style('display', 'none');
            };

            hitArea.on('mouseover', showLabel);
            hitArea.on('mouseout', hideLabel);
            topCircle.on('mouseover', showLabel);
            topCircle.on('mouseout', hideLabel);

            // Add title for native tooltip
            hitArea.append('title')
              .text(annotation.label + (annotation.description ? `\n${annotation.description}` : ''));
          }
        });

      // Add interactive elements for point annotations
      annotationData
        .filter(ad => ad.annotation.type === 'point')
        .forEach(ad => {
          const annotation = ad.annotation;
          if (annotation.date && annotation.value !== undefined) {
            const xPos = xScale(annotation.date);
            const yPos = yScale(annotation.value);

            // Create a group for interactive elements (on top of overlay)
            const interactiveGroup = g.append('g')
              .attr('class', `annotation-point-interactive-${annotation.id}`);

            // Invisible larger circle for easier mouse targeting
            const hitArea = interactiveGroup.append('circle')
              .attr('cx', xPos)
              .attr('cy', yPos)
              .attr('r', 12)
              .attr('fill', 'transparent')
              .attr('cursor', 'help')
              .attr('pointer-events', 'all');

            // Prepare label
            const labelYPos = annotation.position === 'bottom' ? yPos + 20 : yPos - 10;
            const labelText = annotation.label;
            const labelWidth = Math.max(labelText.length * 7, 50);

            // Create label background (hidden initially)
            const labelBg = interactiveGroup.append('rect')
              .attr('x', xPos - labelWidth / 2 - 2)
              .attr('y', labelYPos - 12)
              .attr('width', labelWidth + 4)
              .attr('height', 16)
              .attr('fill', 'white')
              .attr('fill-opacity', 0.95)
              .attr('stroke', ad.color)
              .attr('stroke-width', 1)
              .attr('rx', 3)
              .attr('pointer-events', 'none')
              .style('display', 'none');

            // Create label text (hidden initially)
            const labelTextElem = interactiveGroup.append('text')
              .attr('x', xPos)
              .attr('y', labelYPos)
              .attr('text-anchor', 'middle')
              .attr('font-size', '12px')
              .attr('fill', ad.color)
              .attr('font-weight', 'bold')
              .attr('pointer-events', 'none')
              .text(labelText)
              .style('display', 'none');

            // Show label on mouseover
            const showLabel = function() {
              labelBg.style('display', null);
              labelTextElem.style('display', null);
            };
            const hideLabel = function() {
              labelBg.style('display', 'none');
              labelTextElem.style('display', 'none');
            };

            hitArea.on('mouseover', showLabel);
            hitArea.on('mouseout', hideLabel);

            // Add title for native tooltip
            hitArea.append('title')
              .text(annotation.label + (annotation.description ? `\n${annotation.description}` : ''));
          }
        });
    }

  }, [series, aggregationConfig, shadows, shadowsEnabled, averageShadows, goals, forecastConfig, focusPeriod, currentDomain, chartWidth, height, selectedGoalIndex, annotationsEnabled, annotations, metricAnnotations, aggregatedDataMemo, aggregatedShadowsDataMemo, forecastSnapshot]);

  // Update hover data when shadows or averageShadows change
  useEffect(() => {
    if (!hoverData) return;

    // Recalculate shadow data (only if shadows are enabled)
    const shadowsData = shadowsEnabled ? generateShadowsData(series.data, shadows, undefined) : [];

    // Apply aggregation to shadow data if enabled
    const aggregatedShadowsData = aggregationConfig?.enabled
      ? shadowsData.map(sd => ({
          shadow: sd.shadow,
          data: applyAggregation(sd.data, aggregationConfig),
          color: sd.color
        }))
      : shadowsData;

    const shadowsDataWithValues = aggregatedShadowsData.map(sd => ({
      shadow: sd.shadow,
      data: sd.data.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      })),
      color: sd.color
    }));

    // Calculate averaged shadow data if enabled
    const averagedShadowData = averageShadows && aggregatedShadowsData.length > 1
      ? calculateShadowAverage(aggregatedShadowsData)
      : [];

    // Parse the date back from the string
    const currentDate = new Date(hoverData.date);

    // Find shadow value and label for the current hover date
    const shadowValue = findShadowValue(
      currentDate,
      shadowsDataWithValues,
      averagedShadowData,
      averageShadows
    );
    const shadowLabel = averageShadows && shadowsDataWithValues.length > 1
      ? getAveragedShadowLabel(shadows)
      : shadowsDataWithValues.length > 0
      ? shadowsDataWithValues[0].shadow.label
      : undefined;

    // Update hover data with new shadow information
    setHoverData({
      ...hoverData,
      shadowValue,
      shadowLabel
    });
  }, [shadows, shadowsEnabled, series.data, averageShadows, aggregationConfig]);

  const handleNameSave = () => {
    if (onSeriesUpdate && editedName.trim()) {
      onSeriesUpdate({
        ...series,
        metadata: {
          ...series.metadata,
          name: editedName.trim()
        }
      });
    }
    setIsEditingName(false);
  };

  const handleDescriptionSave = () => {
    if (onSeriesUpdate) {
      onSeriesUpdate({
        ...series,
        metadata: {
          ...series.metadata,
          description: editedDescription.trim()
        }
      });
    }
    setIsEditingDescription(false);
  };

  return (
    <div className="relative">
      <div className="mb-4">
        <div>
          <div className="mb-2">
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') {
                    setEditedName(series.metadata.name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="text-2xl font-bold text-gray-900 border-2 border-blue-500 rounded px-2 py-1 w-full"
              />
            ) : (
              <h2
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 inline-block"
                onDoubleClick={() => setIsEditingName(true)}
                title="Double-click to edit"
              >
                {series.metadata.name}
              </h2>
            )}
          </div>
          <div>
            {isEditingDescription ? (
              <input
                type="text"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onBlur={handleDescriptionSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDescriptionSave();
                  if (e.key === 'Escape') {
                    setEditedDescription(series.metadata.description || '');
                    setIsEditingDescription(false);
                  }
                }}
                autoFocus
                placeholder="Add a description..."
                className="text-sm text-gray-600 border-2 border-blue-500 rounded px-2 py-1 w-full"
              />
            ) : (
              <p
                className="text-sm text-gray-600 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 inline-block"
                onDoubleClick={() => setIsEditingDescription(true)}
                title="Double-click to edit"
              >
                {series.metadata.description || 'Double-click to add description'}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-6 w-full">
        {/* Chart - takes remaining space */}
        <div ref={containerRef} className="flex-1 min-w-0 relative">
          <svg ref={svgRef} className="border border-gray-200 rounded-lg bg-white" />
          {/* Zoom instructions overlay */}
          <div className="absolute top-3 left-3 text-xs text-gray-500 bg-white/90 px-2 py-1 rounded pointer-events-none">
            Click and drag to select zoom window • Shift+drag to pan • Double-click to reset
          </div>
        </div>
        {/* Info panels - 2 columns x 3 rows */}
        <div className="flex-shrink-0" style={{ width: '480px' }}>
          {/* Column titles */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-center font-semibold text-gray-700" style={{ fontSize: '18px' }}>
              {hoverData?.date || '—'}
            </div>
            <div className="text-center font-semibold text-gray-700" style={{ fontSize: '18px' }}>
              {focusPeriodStats?.label || 'Focus Period'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 content-start">
          {/* Panel 1 - Current position data */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[140px] flex flex-col">
            <div className="text-xs font-semibold text-gray-500 mb-1">
              {hoverData?.isForecast ? 'Forecast' : 'Selection'}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              {hoverData && isNaN(hoverData.value) ? (
                <div className="text-gray-500 italic text-sm">No data</div>
              ) : hoverData?.isForecast ? (
                <>
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className="font-bold text-blue-600 mb-1">
                    {formatWithPrecision(hoverData.forecastValue || hoverData.value, hoverData.precision || 0)}
                  </div>
                  {hoverData.rawValue !== undefined && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">vs Current:</span>{' '}
                      <span className={`font-semibold ${
                        (hoverData.value - hoverData.rawValue) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {((hoverData.value - hoverData.rawValue) / hoverData.rawValue * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </>
              ) : hoverData?.rawValue !== undefined ? (
                <>
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className="font-bold text-gray-900 mb-1">
                    {formatWithPrecision(hoverData.value, hoverData.precision || 0)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Point:</span>{' '}
                    <span className="font-semibold">
                      {formatWithPrecision(hoverData.rawValue, hoverData.precision || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '60px', lineHeight: '1' }} className="font-bold text-gray-900">
                  {hoverData ? formatWithPrecision(hoverData.value, hoverData.precision || 0) : '—'}
                </div>
              )}
            </div>
          </div>
          {/* Panel 2 - Focus Period Stats */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[140px] flex flex-col">
            {focusPeriodStats ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  {focusPeriodStats.isForecast && focusPeriodStats.actualCount === 0 && (
                    <span className="text-blue-600">(Forecast)</span>
                  )}
                  {focusPeriodStats.isForecast && focusPeriodStats.actualCount! > 0 && (
                    <span className="text-blue-600">(w/ Forecast)</span>
                  )}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className={`font-bold mb-1 ${focusPeriodStats.isForecast ? 'text-blue-600' : 'text-gray-900'}`}>
                    {formatWithPrecision(focusPeriodStats.mean, focusPeriodStats.precision)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Range:</span>{' '}
                    <span className="font-semibold">
                      {formatWithPrecision(focusPeriodStats.min, focusPeriodStats.precision)} - {formatWithPrecision(focusPeriodStats.max, focusPeriodStats.precision)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-gray-400">No focus period</div>
              </div>
            )}
          </div>

          {/* Panel 3 - Shadow Comparison */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[140px] flex flex-col col-span-1">
            {hoverData?.shadowValue !== undefined && hoverData?.shadowLabel ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  vs. {hoverData.shadowLabel}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className={`font-bold mb-1 ${
                    ((hoverData.forecastValue || hoverData.value) - hoverData.shadowValue) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {((hoverData.forecastValue || hoverData.value) - hoverData.shadowValue) >= 0 ? '+' : ''}
                    {formatWithPrecision((hoverData.forecastValue || hoverData.value) - hoverData.shadowValue, hoverData.precision || 0)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Difference:</span>{' '}
                    <span className={`font-semibold ${
                      (((hoverData.forecastValue || hoverData.value) - hoverData.shadowValue) / hoverData.shadowValue * 100) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(((hoverData.forecastValue || hoverData.value) - hoverData.shadowValue) / hoverData.shadowValue * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-gray-400">No shadow selected</div>
              </div>
            )}
          </div>

          {/* Panel 4 - Focus Period vs Shadow */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[140px] flex flex-col">
            {focusPeriodStats?.shadowMean !== undefined && focusPeriodStats?.shadowLabel ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  {focusPeriodStats.isForecast && focusPeriodStats.actualCount === 0 && (
                    <span className="text-blue-600">(Forecast) </span>
                  )}
                  vs. {focusPeriodStats.shadowLabel}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className={`font-bold mb-1 ${
                    (focusPeriodStats.mean - focusPeriodStats.shadowMean) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {(focusPeriodStats.mean - focusPeriodStats.shadowMean) >= 0 ? '+' : ''}
                    {formatWithPrecision(focusPeriodStats.mean - focusPeriodStats.shadowMean, focusPeriodStats.precision)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Difference:</span>{' '}
                    <span className={`font-semibold ${
                      ((focusPeriodStats.mean - focusPeriodStats.shadowMean) / focusPeriodStats.shadowMean * 100) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {((focusPeriodStats.mean - focusPeriodStats.shadowMean) / focusPeriodStats.shadowMean * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-gray-400">No focus period or shadow</div>
              </div>
            )}
          </div>

          {/* Panel 5 - Goal Comparison */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[140px] flex flex-col col-span-1">
            {hoverData?.goalValue !== undefined && hoverData?.goalLabel ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center justify-between">
                  <span>vs. {hoverData.goalLabel} goal</span>
                  {goals.filter(g => g.enabled).length > 1 && (
                    <div className="flex gap-0.5 items-center">
                      <button
                        onClick={() => {
                          const newIndex = Math.max(0, selectedGoalIndex - 1);
                          setSelectedGoalIndex(newIndex);
                          // Force re-render of hover data with new goal
                          if (hoverData) {
                            const goalValue = findGoalValue(new Date(hoverData.date), goalsDataRef.current, newIndex);
                            const goalLabel = goalsDataRef.current[newIndex]?.goal.label;
                            setHoverData({
                              ...hoverData,
                              goalValue,
                              goalLabel
                            });
                          }
                        }}
                        disabled={selectedGoalIndex === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed"
                        title="Previous goal"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const newIndex = Math.min(goals.filter(g => g.enabled).length - 1, selectedGoalIndex + 1);
                          setSelectedGoalIndex(newIndex);
                          // Force re-render of hover data with new goal
                          if (hoverData) {
                            const goalValue = findGoalValue(new Date(hoverData.date), goalsDataRef.current, newIndex);
                            const goalLabel = goalsDataRef.current[newIndex]?.goal.label;
                            setHoverData({
                              ...hoverData,
                              goalValue,
                              goalLabel
                            });
                          }
                        }}
                        disabled={selectedGoalIndex === goals.filter(g => g.enabled).length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed"
                        title="Next goal"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className={`font-bold mb-1 ${
                    ((hoverData.forecastValue || hoverData.value) - hoverData.goalValue) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {((hoverData.forecastValue || hoverData.value) - hoverData.goalValue) >= 0 ? '+' : ''}
                    {formatWithPrecision((hoverData.forecastValue || hoverData.value) - hoverData.goalValue, hoverData.precision || 0)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Difference:</span>{' '}
                    <span className={`font-semibold ${
                      (((hoverData.forecastValue || hoverData.value) - hoverData.goalValue) / hoverData.goalValue * 100) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(((hoverData.forecastValue || hoverData.value) - hoverData.goalValue) / hoverData.goalValue * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-gray-400">No goal selected</div>
              </div>
            )}
          </div>

          {/* Panel 6 - Focus Period vs Goal */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[140px] flex flex-col">
            {focusPeriodStats?.goalMean !== undefined && focusPeriodStats?.goalLabel ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  {focusPeriodStats.isForecast && focusPeriodStats.actualCount === 0 && (
                    <span className="text-blue-600">(Forecast) </span>
                  )}
                  vs. {focusPeriodStats.goalLabel} goal
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div style={{ fontSize: '60px', lineHeight: '1' }} className={`font-bold mb-1 ${
                    (focusPeriodStats.mean - focusPeriodStats.goalMean) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {(focusPeriodStats.mean - focusPeriodStats.goalMean) >= 0 ? '+' : ''}
                    {formatWithPrecision(focusPeriodStats.mean - focusPeriodStats.goalMean, focusPeriodStats.precision)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Difference:</span>{' '}
                    <span className={`font-semibold ${
                      ((focusPeriodStats.mean - focusPeriodStats.goalMean) / focusPeriodStats.goalMean * 100) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {((focusPeriodStats.mean - focusPeriodStats.goalMean) / focusPeriodStats.goalMean * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-gray-400">No focus period or goal</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
