import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Series, TimeSeriesPoint } from '../types/series';
import type { SmoothingConfig } from '../utils/smoothing';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import { calculateRollingAverage } from '../utils/smoothing';
import { generateShadowsData, calculateShadowAverage } from '../utils/shadows';
import { generateGoalsData } from '../utils/goals';

interface TimeSeriesChartProps {
  series: Series;
  smoothingConfig?: SmoothingConfig;
  shadows?: Shadow[];
  averageShadows?: boolean;
  goals?: Goal[];
  width?: number;
  height?: number;
  onSeriesUpdate?: (series: Series) => void;
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

  // For continuous goals (only 2 points), return the constant value if date is within range
  if (goalData.goal.type === 'continuous' && goalData.data.length === 2) {
    const startDate = goalData.data[0].date;
    const endDate = goalData.data[1].date;
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

export function TimeSeriesChart({
  series,
  smoothingConfig,
  shadows = [],
  averageShadows = false,
  goals = [],
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

  useEffect(() => {
    if (!svgRef.current || !series.data.length) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up margins
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
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

    // Calculate the maximum precision from the raw data
    const dataPrecision = Math.max(
      ...dataWithValues.slice(0, 100).map(d => getDecimalPrecision(d.value))
    );

    // Calculate smoothed data if enabled
    let smoothedData: TimeSeriesPoint[] = [];
    let smoothedDataWithValues: Array<{ date: Date; value: number }> = [];

    if (smoothingConfig?.enabled) {
      smoothedData = calculateRollingAverage(
        series.data,
        smoothingConfig.period,
        smoothingConfig.unit
      );
      smoothedDataWithValues = smoothedData.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      }));
    }

    // Create scales - use smoothed data for domain if available
    const displayData = smoothingConfig?.enabled && smoothedDataWithValues.length > 0
      ? smoothedDataWithValues
      : dataWithValues;

    // Fill gaps with null values to create visual breaks in the line
    // Use displayData so gaps are detected in the currently displayed data (smoothed or raw)
    const dataWithGaps = fillGapsWithNulls(displayData);

    // Generate shadow data
    const shadowsData = generateShadowsData(series.data, shadows);

    // Convert shadow data to include calculated values for comparison
    const shadowsDataWithValues = shadowsData.map(sd => ({
      shadow: sd.shadow,
      data: sd.data.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      })),
      color: sd.color
    }));

    // Calculate averaged shadow data if enabled
    const averagedShadowData = averageShadows && shadowsData.length > 1
      ? calculateShadowAverage(shadowsData)
      : [];

    // Generate goal data
    const goalsData = generateGoalsData(series.data, goals);

    // Convert goal data to include calculated values for comparison
    const goalsDataWithValues = goalsData.map(gd => ({
      goal: gd.goal,
      data: gd.data.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      })),
      color: gd.color
    }));

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
    // Include goal dates in the extent calculation
    let fullExtent = d3.extent(dataWithValues, d => d.date) as [Date, Date];

    // Extend the extent if goals go beyond the data range
    goalsData.forEach(goalData => {
      if (goalData.data.length > 0) {
        const goalExtent = d3.extent(goalData.data, d => d.date) as [Date, Date];
        if (goalExtent[0] < fullExtent[0]) fullExtent[0] = goalExtent[0];
        if (goalExtent[1] > fullExtent[1]) fullExtent[1] = goalExtent[1];
      }
    });

    const initialDomain = currentDomain || fullExtent;

    const xScale = d3
      .scaleTime()
      .domain(initialDomain)
      .range([0, innerWidth]);

    // Use currentYDomain if zoomed, otherwise calculate from data and goals
    let yDomain: [number, number];
    if (currentYDomain) {
      yDomain = currentYDomain;
    } else {
      // Get max from data
      const dataMax = d3.max(dataWithValues, d => d.value) as number;

      // Get max from goals
      let goalMax = 0;
      goalsDataWithValues.forEach(gd => {
        const gdMax = d3.max(gd.data, d => d.value) as number;
        if (gdMax > goalMax) goalMax = gdMax;
      });

      // Use the higher of data max or goal max, with 10% padding
      const overallMax = Math.max(dataMax, goalMax) * 1.1;
      yDomain = [0, overallMax];
    }

    const yScale = d3
      .scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0]);

    // Create line generator
    const line = d3
      .line<{ date: Date; value: number | null }>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value as number))
      .defined(d => d.value != null && !isNaN(d.value) && isFinite(d.value))
      .curve(d3.curveLinear);

    // Draw axes with custom formatting
    // Custom x-axis formatter that shows year when it changes
    let previousYear: number | null = null;
    const xAxis = d3.axisBottom(xScale).tickFormat((domainValue) => {
      const date = domainValue as Date;
      const currentYear = date.getFullYear();
      const shouldShowYear = previousYear === null || currentYear !== previousYear;
      previousYear = currentYear;

      // Format: "Oct 27" or "Oct 27, 2024" (with year when it changes)
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();

      return shouldShowYear ? `${month} ${day}, ${currentYear}` : `${month} ${day}`;
    });

    const yAxis = d3.axisLeft(yScale);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    // Draw shadows or averaged shadow (drawn first so they appear behind main line)
    if (averageShadows && averagedShadowData.length > 0) {
      // Draw shaded area for standard deviation
      const area = d3
        .area<typeof averagedShadowData[0]>()
        .x(d => xScale(d.date))
        .y0(d => yScale(Math.max(0, d.mean - d.stdDev)))
        .y1(d => yScale(d.mean + d.stdDev))
        .defined(d => d.mean != null && d.stdDev != null && !isNaN(d.mean) && isFinite(d.mean) && !isNaN(d.stdDev) && isFinite(d.stdDev))
        .curve(d3.curveLinear);

      chartGroup.append('path')
        .datum(averagedShadowData)
        .attr('class', 'shadow-std-area')
        .attr('fill', '#9ca3af')
        .attr('opacity', 0.3)
        .attr('d', area);

      // Draw mean line (half the width of main series line)
      const meanLine = d3
        .line<typeof averagedShadowData[0]>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.mean))
        .defined(d => d.mean != null && !isNaN(d.mean) && isFinite(d.mean))
        .curve(d3.curveLinear);

      chartGroup.append('path')
        .datum(averagedShadowData)
        .attr('class', 'shadow-mean-line')
        .attr('fill', 'none')
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', meanLine);
    } else {
      // Draw individual shadows in reverse order (oldest first, so they appear in back)
      // This ensures older shadows are behind newer ones
      const reversedShadows = [...shadowsData].reverse();
      reversedShadows.forEach(shadowData => {
        const shadowValues = shadowData.data
          .map(d => ({
            date: d.date,
            value: d.numerator / d.denominator
          }))
          .filter(d => !isNaN(d.value) && isFinite(d.value));

        if (shadowValues.length > 0) {
          chartGroup.append('path')
            .datum(shadowValues)
            .attr('class', `shadow-line-${shadowData.shadow.id}`)
            .attr('fill', 'none')
            .attr('stroke', shadowData.color)
            .attr('stroke-width', 1)
            .attr('opacity', 0.7)
            .attr('d', line);
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
        const goalLine = d3
          .line<{ date: Date; value: number }>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.value))
          .defined(d => !isNaN(d.value) && isFinite(d.value))
          .curve(d3.curveLinear);

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

    // If smoothing is enabled, draw original data as points
    if (smoothingConfig?.enabled && smoothedDataWithValues.length > 0) {
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

    // Create hover circle for raw data point (when smoothing is enabled)
    const hoverCircleRaw = g
      .append('circle')
      .attr('class', 'hover-circle-raw')
      .attr('r', 5)
      .attr('fill', '#93c5fd')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
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
    const bisect = d3.bisector<{ date: Date; value: number | null }, Date>(d => d.date).left;

    // Mouse move handler
    overlay.on('mousemove', function(event) {
      const [mouseX] = d3.pointer(event);
      const hoveredDate = xScale.invert(mouseX);

      // Always show the vertical line at mouse position
      hoverLine
        .attr('x1', mouseX)
        .attr('x2', mouseX)
        .style('opacity', 1);

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

        // If smoothing is enabled, find and highlight the raw data point
        let rawValue: number | undefined;
        if (smoothingConfig?.enabled && dataWithValues.length > 0) {
          const rawPoint = dataWithValues.find(p => p.date.getTime() === d.date.getTime());
          if (rawPoint) {
            rawValue = rawPoint.value;
            const rawY = yScale(rawPoint.value);
            hoverCircleRaw
              .attr('cx', x)
              .attr('cy', rawY)
              .style('opacity', 1);
          } else {
            hoverCircleRaw.style('opacity', 0);
          }
        } else {
          hoverCircleRaw.style('opacity', 0);
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

        setHoverData({
          date: d.date.toLocaleDateString(),
          value: d.value as number,
          rawValue,
          precision: dataPrecision,
          shadowValue,
          shadowLabel,
          goalValue,
          goalLabel
        });
      } else {
        // Hovering over a gap - hide circles but show date
        hoverCircle.style('opacity', 0);
        hoverCircleRaw.style('opacity', 0);

        // Show the date we're hovering over even if there's no data
        setHoverData({
          date: hoveredDate.toLocaleDateString(),
          value: NaN, // Use NaN to indicate no data
          precision: dataPrecision
        });
      }
    });

    overlay.on('mouseout', function() {
      hoverLine.style('opacity', 0);
      hoverCircle.style('opacity', 0);
      hoverCircleRaw.style('opacity', 0);
      // Set to most recent data point instead of null
      const mostRecent = displayData[displayData.length - 1];
      if (mostRecent) {
        // If smoothing is enabled, find the raw data point for the most recent date
        let rawValue: number | undefined;
        if (smoothingConfig?.enabled && dataWithValues.length > 0) {
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
    const brush = d3.brush()
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
      const fullYExtent = [0, d3.max(dataWithValues, d => d.value) as number * 1.1];

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
      yScale.domain([0, d3.max(dataWithValues, d => d.value) as number * 1.1]);
      updateChart();
    });

    // Wheel/trackpad pinch zoom
    svg.on('wheel', function(event) {
      event.preventDefault();

      // Get mouse position relative to the chart
      const [mouseX, mouseY] = d3.pointer(event);

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
      const fullYExtent = [0, d3.max(dataWithValues, d => d.value) as number * 1.1];
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
          const goalLine = d3
            .line<{ date: Date; value: number }>()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .defined(d => !isNaN(d.value) && isFinite(d.value))
            .curve(d3.curveLinear);
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
        const area = d3
          .area<typeof averagedShadowData[0]>()
          .x(d => xScale(d.date))
          .y0(d => yScale(Math.max(0, d.mean - d.stdDev)))
          .y1(d => yScale(d.mean + d.stdDev))
          .defined(d => d.mean != null && d.stdDev != null && !isNaN(d.mean) && isFinite(d.mean) && !isNaN(d.stdDev) && isFinite(d.stdDev))
          .curve(d3.curveLinear);

        const meanLine = d3
          .line<typeof averagedShadowData[0]>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.mean))
          .defined(d => d.mean != null && !isNaN(d.mean) && isFinite(d.mean))
          .curve(d3.curveLinear);

        g.select('.shadow-std-area')
          .attr('d', area as any);

        g.select('.shadow-mean-line')
          .attr('d', meanLine as any);
      }

      // Update points - filter to only visible data for performance
      if (smoothingConfig?.enabled) {
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

  }, [series, smoothingConfig, shadows, averageShadows, goals, currentDomain, chartWidth, height, selectedGoalIndex]);

  // Update hover data when shadows or averageShadows change
  useEffect(() => {
    if (!hoverData) return;

    // Recalculate shadow data
    const shadowsData = generateShadowsData(series.data, shadows);
    const shadowsDataWithValues = shadowsData.map(sd => ({
      shadow: sd.shadow,
      data: sd.data.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      })),
      color: sd.color
    }));

    // Calculate averaged shadow data if enabled
    const averagedShadowData = averageShadows && shadowsData.length > 1
      ? calculateShadowAverage(shadowsData)
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
  }, [shadows, series.data, averageShadows]);

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
        <div className="grid grid-cols-2 gap-2 content-start flex-shrink-0" style={{ width: '600px' }}>
          {/* Panel 1 - Current position data */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[100px] flex flex-col">
            <div className="text-xs font-semibold text-gray-500 mb-1">Selection</div>
            <div className="font-mono text-xs space-y-1 flex-1 flex flex-col justify-center">
              <div className="text-gray-600">
                <span className="font-medium">Date:</span>{' '}
                <span className="font-semibold text-gray-900">
                  {hoverData?.date || '—'}
                </span>
              </div>
              {hoverData && isNaN(hoverData.value) ? (
                <div className="text-gray-600">
                  <span className="font-medium">Value:</span>{' '}
                  <span className="font-semibold text-gray-500 italic">
                    No data
                  </span>
                </div>
              ) : hoverData?.rawValue !== undefined ? (
                <>
                  <div className="text-gray-600">
                    <span className="font-medium">Point:</span>{' '}
                    <span className="font-semibold text-gray-900">
                      {formatWithPrecision(hoverData.rawValue, hoverData.precision || 0)}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">Smoothed:</span>{' '}
                    <span className="font-semibold text-gray-900">
                      {formatWithPrecision(hoverData.value, hoverData.precision || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-gray-600">
                  <span className="font-medium">Value:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {hoverData ? formatWithPrecision(hoverData.value, hoverData.precision || 0) : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Panel 2 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-[100px] flex items-center justify-center">
            <div className="text-xs text-gray-400">Panel 2</div>
          </div>

          {/* Panel 3 - Shadow Comparison */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[100px] flex flex-col col-span-1">
            {hoverData?.shadowValue !== undefined && hoverData?.shadowLabel ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  vs. {hoverData.shadowLabel}
                </div>
                <div className="font-mono text-xs space-y-1 flex-1 flex flex-col justify-center">
                  <div className="text-gray-600">
                    <span className="font-medium">Difference (%):</span>{' '}
                    <span className={`font-semibold ${
                      ((hoverData.value - hoverData.shadowValue) / hoverData.shadowValue * 100) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {((hoverData.value - hoverData.shadowValue) / hoverData.shadowValue * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">Delta:</span>{' '}
                    <span className={`font-semibold ${
                      (hoverData.value - hoverData.shadowValue) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(hoverData.value - hoverData.shadowValue) >= 0 ? '+' : ''}
                      {formatWithPrecision(hoverData.value - hoverData.shadowValue, hoverData.precision || 0)}
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

          {/* Panel 4 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-[100px] flex items-center justify-center">
            <div className="text-xs text-gray-400">Panel 4</div>
          </div>

          {/* Panel 5 - Goal Comparison */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 h-[100px] flex flex-col col-span-1">
            {hoverData?.goalValue !== undefined && hoverData?.goalLabel ? (
              <>
                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center justify-between">
                  <span>vs. {hoverData.goalLabel}</span>
                  {goals.filter(g => g.enabled).length > 1 && (
                    <div className="flex gap-0.5 items-center">
                      <button
                        onClick={() => {
                          const newIndex = Math.max(0, selectedGoalIndex - 1);
                          setSelectedGoalIndex(newIndex);
                          // Force re-render of hover data with new goal
                          if (hoverData) {
                            const goalsData = generateGoalsData(series.data, goals);
                            const goalsDataWithValues = goalsData.map(gd => ({
                              goal: gd.goal,
                              data: gd.data.map(d => ({
                                date: d.date,
                                value: d.numerator / d.denominator
                              })),
                              color: gd.color
                            }));
                            const goalValue = findGoalValue(new Date(hoverData.date), goalsDataWithValues, newIndex);
                            const goalLabel = goalsDataWithValues[newIndex]?.goal.label;
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
                            const goalsData = generateGoalsData(series.data, goals);
                            const goalsDataWithValues = goalsData.map(gd => ({
                              goal: gd.goal,
                              data: gd.data.map(d => ({
                                date: d.date,
                                value: d.numerator / d.denominator
                              })),
                              color: gd.color
                            }));
                            const goalValue = findGoalValue(new Date(hoverData.date), goalsDataWithValues, newIndex);
                            const goalLabel = goalsDataWithValues[newIndex]?.goal.label;
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
                <div className="font-mono text-xs space-y-1 flex-1 flex flex-col justify-center">
                  <div className="text-gray-600">
                    <span className="font-medium">Difference (%):</span>{' '}
                    <span className={`font-semibold ${
                      ((hoverData.value - hoverData.goalValue) / hoverData.goalValue * 100) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {((hoverData.value - hoverData.goalValue) / hoverData.goalValue * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">Delta:</span>{' '}
                    <span className={`font-semibold ${
                      (hoverData.value - hoverData.goalValue) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(hoverData.value - hoverData.goalValue) >= 0 ? '+' : ''}
                      {formatWithPrecision(hoverData.value - hoverData.goalValue, hoverData.precision || 0)}
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

          {/* Panel 6 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-[100px] flex items-center justify-center">
            <div className="text-xs text-gray-400">Panel 6</div>
          </div>
        </div>
      </div>
    </div>
  );
}
