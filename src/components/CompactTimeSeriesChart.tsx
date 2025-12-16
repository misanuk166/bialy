import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Series } from '../types/series';
import type { AggregationConfig } from '../utils/aggregation';
import type { ForecastConfig } from '../types/forecast';
import type { FocusPeriod } from '../types/focusPeriod';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import { applyAggregation, normalizeSelectionDate } from '../utils/aggregation';
import { generateForecast } from '../utils/forecasting';
import { generateShadowsData, calculateShadowAverage } from '../utils/shadows';
import { generateGoalsData } from '../utils/goals';

interface CompactTimeSeriesChartProps {
  series: Series;
  aggregationConfig?: AggregationConfig;
  shadows?: Shadow[];
  averageShadows?: boolean;
  forecastConfig?: ForecastConfig;
  focusPeriod?: FocusPeriod;
  goals?: Goal[];
  xDomain: [Date, Date];
  width: number;
  height?: number;
  showXAxis?: boolean;
  selectionDate?: Date;
  currentHoverDate?: Date;
  onHover?: (date: Date | null) => void;
  onClick?: (date: Date) => void;
  onZoom?: (domain: [Date, Date]) => void;
}

export function CompactTimeSeriesChart({
  series,
  aggregationConfig,
  shadows,
  averageShadows,
  forecastConfig,
  focusPeriod,
  goals = [],
  xDomain,
  width,
  height = 72,
  showXAxis = false,
  selectionDate,
  currentHoverDate,
  onHover,
  onClick,
  onZoom
}: CompactTimeSeriesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !series.data.length) return;

    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 5, right: 30, bottom: showXAxis ? 25 : 0, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    const dataWithValues = series.data.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));

    // Apply aggregation if enabled
    let displayData = dataWithValues;
    if (aggregationConfig?.enabled) {
      const aggregated = applyAggregation(series.data, aggregationConfig);
      displayData = aggregated.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      }));
    }

    // Filter data to xDomain range
    displayData = displayData.filter(d =>
      d.date >= xDomain[0] && d.date <= xDomain[1]
    );

    // Generate shadow data
    const shadowsData = shadows && shadows.length > 0 ? generateShadowsData(series.data, shadows) : [];

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
      data: sd.data
        .map(d => ({
          date: d.date,
          value: d.numerator / d.denominator
        }))
        .filter(d => d.date >= xDomain[0] && d.date <= xDomain[1]), // Filter shadow data to xDomain
      color: sd.color
    }));

    // Calculate averaged shadow data if enabled
    let averagedShadowData = averageShadows && aggregatedShadowsData.length > 1
      ? calculateShadowAverage(aggregatedShadowsData)
      : [];

    // Filter averaged shadow data to xDomain
    if (averagedShadowData.length > 0) {
      averagedShadowData = averagedShadowData.filter(d =>
        d.date >= xDomain[0] && d.date <= xDomain[1]
      );
    }

    // Generate forecast
    let forecastData: Array<{ date: Date; value: number }> = [];
    let confidenceIntervals: { upper: number[]; lower: number[] } | undefined;

    if (forecastConfig?.enabled) {
      const forecastResult = generateForecast(displayData, forecastConfig);
      if (forecastResult) {
        forecastData = forecastResult.forecast;
        confidenceIntervals = forecastResult.confidenceIntervals;
      }
    }

    // Create scales
    const xScale = d3.scaleTime()
      .domain(xDomain)
      .range([0, innerWidth]);

    const allValues = [...displayData.map(d => d.value)];

    // Include shadow values in y-scale
    if (averagedShadowData.length > 0) {
      allValues.push(...averagedShadowData.map(d => d.mean));
      allValues.push(...averagedShadowData.map(d => d.mean + d.stdDev));
    } else {
      shadowsDataWithValues.forEach(sd => {
        allValues.push(...sd.data.map(d => d.value));
      });
    }

    if (forecastData.length > 0) {
      allValues.push(...forecastData.map(d => d.value));
      if (confidenceIntervals) {
        allValues.push(...confidenceIntervals.upper, ...confidenceIntervals.lower);
      }
    }

    // Calculate min/max with 20% padding
    const minValue = d3.min(allValues) as number;
    const maxValue = d3.max(allValues) as number;
    const range = maxValue - minValue;
    const yMin = minValue - (range * 0.2);
    const yMax = maxValue + (range * 0.2);

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);

    // Draw focus period highlight
    if (focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
      const startX = xScale(focusPeriod.startDate);
      const endX = xScale(focusPeriod.endDate);

      g.append('rect')
        .attr('x', startX)
        .attr('y', 0)
        .attr('width', endX - startX)
        .attr('height', innerHeight)
        .attr('fill', '#fbbf24')
        .attr('fill-opacity', 0.1);
    }

    // Draw confidence interval
    if (confidenceIntervals && forecastData.length > 0) {
      const areaGenerator = d3.area<{ date: Date; upper: number; lower: number }>()
        .x(d => xScale(d.date))
        .y0(d => yScale(d.lower))
        .y1(d => yScale(d.upper));

      const ciData = forecastData.map((fp, i) => ({
        date: fp.date,
        upper: confidenceIntervals!.upper[i],
        lower: confidenceIntervals!.lower[i]
      }));

      g.append('path')
        .datum(ciData)
        .attr('fill', '#93c5fd')
        .attr('fill-opacity', 0.3)
        .attr('d', areaGenerator);
    }

    // Create line generator
    const line = d3.line<{ date: Date; value: number }>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveLinear);

    // Draw shadows or averaged shadow (drawn first so they appear behind main line)
    if (averageShadows && averagedShadowData.length > 0) {
      // Draw shaded area for standard deviation
      const area = d3.area<typeof averagedShadowData[0]>()
        .x(d => xScale(d.date))
        .y0(d => yScale(Math.max(0, d.mean - d.stdDev)))
        .y1(d => yScale(d.mean + d.stdDev))
        .defined(d => d.mean != null && d.stdDev != null && !isNaN(d.mean) && isFinite(d.mean) && !isNaN(d.stdDev) && isFinite(d.stdDev))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(averagedShadowData)
        .attr('fill', '#9ca3af')
        .attr('opacity', 0.3)
        .attr('d', area);

      // Draw mean line
      const meanLine = d3.line<typeof averagedShadowData[0]>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.mean))
        .defined(d => d.mean != null && !isNaN(d.mean) && isFinite(d.mean))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(averagedShadowData)
        .attr('fill', 'none')
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', meanLine);
    } else {
      // Draw individual shadows in reverse order (oldest first)
      const reversedShadows = [...shadowsDataWithValues].reverse();
      reversedShadows.forEach(shadowData => {
        if (shadowData.data.length > 0) {
          g.append('path')
            .datum(shadowData.data)
            .attr('fill', 'none')
            .attr('stroke', shadowData.color)
            .attr('stroke-width', 1)
            .attr('opacity', 0.7)
            .attr('d', line);
        }
      });
    }

    // Draw primary series line

    g.append('path')
      .datum(displayData)
      .attr('fill', 'none')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw forecast line
    if (forecastData.length > 0) {
      g.append('path')
        .datum(forecastData)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('d', line);
    }

    // Draw goals
    if (goals && goals.length > 0) {
      const forecastEndDate = forecastData.length > 0 ? forecastData[forecastData.length - 1].date : undefined;
      const goalsData = generateGoalsData(series.data, goals, forecastEndDate);

      goalsData.forEach(goalData => {
        const goalValues = goalData.data
          .map(d => ({
            date: d.date,
            value: d.numerator / d.denominator
          }))
          .filter(d => d.date >= xDomain[0] && d.date <= xDomain[1] && !isNaN(d.value) && isFinite(d.value));

        if (goalValues.length > 0) {
          const goalLine = d3.line<{ date: Date; value: number }>()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .defined(d => !isNaN(d.value) && isFinite(d.value))
            .curve(d3.curveLinear);

          g.append('path')
            .datum(goalValues)
            .attr('fill', 'none')
            .attr('stroke', goalData.color)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.8)
            .attr('d', goalLine);

          // Add label for continuous goals
          if (goalData.goal.type === 'continuous' && showXAxis) {
            const yPosition = yScale(goalValues[0].value);
            g.append('text')
              .attr('x', 5)
              .attr('y', yPosition - 5)
              .attr('text-anchor', 'start')
              .attr('font-size', '10px')
              .attr('fill', goalData.color)
              .attr('font-weight', 'bold')
              .text(goalData.goal.label);
          }
        }
      });
    }

    // Y-axis (minimal)
    const yAxis = d3.axisLeft(yScale).ticks(3).tickSize(3);
    g.append('g')
      .attr('class', 'y-axis')
      .style('font-size', '9px')
      .call(yAxis);

    // X-axis (only when showXAxis is true)
    if (showXAxis) {
      const xAxis = d3.axisBottom(xScale).ticks(6).tickSize(3);
      g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .style('font-size', '9px')
        .call(xAxis);
    }

    // Selection line (dashed, persistent - shows locked selection)
    const selectionLine = g.append('line')
      .attr('stroke', '#000000')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    if (selectionDate) {
      // Normalize selection date to match aggregation period
      const normalizedSelectionDate = normalizeSelectionDate(selectionDate, aggregationConfig);
      const x = xScale(normalizedSelectionDate);
      selectionLine
        .attr('x1', x)
        .attr('x2', x)
        .style('opacity', 1);
    }

    // Hover line (dashed, temporary - shows mouse position)
    const hoverLine = g.append('line')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    // Hover circle and label group for main series
    const hoverGroup = g.append('g').style('opacity', 0);
    const hoverCircle = hoverGroup.append('circle')
      .attr('r', 5)
      .attr('fill', '#2563eb')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    const hoverTextBg = hoverGroup.append('rect')
      .attr('fill', 'white')
      .attr('stroke', '#ccc')
      .attr('rx', 2);

    const hoverLabel = hoverGroup.append('text')
      .attr('text-anchor', 'start')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .attr('fill', '#333');

    // Additional hover elements when expanded (for goals, forecast, shadows)
    const hoverGroupGoal = g.append('g').style('opacity', 0);
    const hoverCircleGoal = hoverGroupGoal.append('circle')
      .attr('r', 4)
      .attr('fill', '#ef4444')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    const hoverTextBgGoal = hoverGroupGoal.append('rect')
      .attr('fill', 'white')
      .attr('stroke', '#ccc')
      .attr('rx', 2);

    const hoverLabelGoal = hoverGroupGoal.append('text')
      .attr('text-anchor', 'start')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .attr('fill', '#ef4444');

    const hoverGroupForecast = g.append('g').style('opacity', 0);
    const hoverCircleForecast = hoverGroupForecast.append('circle')
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    const hoverTextBgForecast = hoverGroupForecast.append('rect')
      .attr('fill', 'white')
      .attr('stroke', '#ccc')
      .attr('rx', 2);

    const hoverLabelForecast = hoverGroupForecast.append('text')
      .attr('text-anchor', 'start')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .attr('fill', '#3b82f6');

    const hoverGroupShadow = g.append('g').style('opacity', 0);
    const hoverCircleShadow = hoverGroupShadow.append('circle')
      .attr('r', 4)
      .attr('fill', '#6b7280')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    const hoverTextBgShadow = hoverGroupShadow.append('rect')
      .attr('fill', 'white')
      .attr('stroke', '#ccc')
      .attr('rx', 2);

    const hoverLabelShadow = hoverGroupShadow.append('text')
      .attr('text-anchor', 'start')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .attr('fill', '#6b7280');

    // Overlay for interactions
    const overlay = g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair');

    // Handle hover
    overlay.on('mousemove', function(event) {
      const [mouseX] = d3.pointer(event);
      const hoveredDate = xScale.invert(mouseX);

      // Combine display data and forecast data for hover detection
      const allHoverableData = [...displayData, ...forecastData];

      // Find closest data point (including forecast)
      const bisect = d3.bisector((d: any) => d.date).left;
      const index = bisect(allHoverableData, hoveredDate);
      const d0 = allHoverableData[index - 1];
      const d1 = allHoverableData[index];
      const closestPoint = !d1 ? d0 : !d0 ? d1 :
        hoveredDate.getTime() - d0.date.getTime() > d1.date.getTime() - hoveredDate.getTime() ? d1 : d0;

      if (closestPoint) {
        const x = xScale(closestPoint.date);
        const y = yScale(closestPoint.value);

        hoverLine
          .attr('x1', x)
          .attr('x2', x)
          .style('opacity', 1);

        hoverCircle
          .attr('cx', x)
          .attr('cy', y);

        // Position text to upper-right of circle
        const labelText = closestPoint.value.toFixed(2);
        const textWidth = labelText.length * 6 + 4; // Approximate width

        hoverTextBg
          .attr('x', x + 5)
          .attr('y', y - 16)
          .attr('width', textWidth)
          .attr('height', 12);

        hoverLabel
          .attr('x', x + 6)
          .attr('y', y - 6)
          .text(labelText);

        hoverGroup.style('opacity', 1);

        // Show goal hover if expanded and goals exist
        if (showXAxis && goals && goals.length > 0) {
          const goalsData = generateGoalsData(series.data, goals);
          const firstGoalData = goalsData[0];
          if (firstGoalData) {
            const goalBisect = d3.bisector((d: any) => d.date).left;
            const goalIndex = goalBisect(firstGoalData.data, closestPoint.date);
            const g0 = firstGoalData.data[goalIndex - 1];
            const g1 = firstGoalData.data[goalIndex];
            const closestGoal = !g1 ? g0 : !g0 ? g1 :
              closestPoint.date.getTime() - g0.date.getTime() > g1.date.getTime() - closestPoint.date.getTime() ? g1 : g0;

            if (closestGoal) {
              const goalValue = closestGoal.numerator / closestGoal.denominator;
              const goalY = yScale(goalValue);
              const goalText = goalValue.toFixed(2);
              const goalTextWidth = goalText.length * 6 + 4;

              hoverCircleGoal
                .attr('cx', x)
                .attr('cy', goalY);

              hoverTextBgGoal
                .attr('x', x + 5)
                .attr('y', goalY - 16)
                .attr('width', goalTextWidth)
                .attr('height', 12);

              hoverLabelGoal
                .attr('x', x + 6)
                .attr('y', goalY - 6)
                .text(goalText)
                .attr('fill', firstGoalData.color);

              hoverCircleGoal.attr('fill', firstGoalData.color);
              hoverGroupGoal.style('opacity', 1);
            } else {
              hoverGroupGoal.style('opacity', 0);
            }
          } else {
            hoverGroupGoal.style('opacity', 0);
          }
        } else {
          hoverGroupGoal.style('opacity', 0);
        }

        // Show shadow hover if expanded and shadows exist
        if (showXAxis && (averagedShadowData.length > 0 || shadowsDataWithValues.length > 0)) {
          let shadowValue: number | undefined;
          let shadowExists = false;

          if (averageShadows && averagedShadowData.length > 0) {
            const shadowBisect = d3.bisector((d: any) => d.date).left;
            const shadowIndex = shadowBisect(averagedShadowData, closestPoint.date);
            const s0 = averagedShadowData[shadowIndex - 1];
            const s1 = averagedShadowData[shadowIndex];
            const closestShadow = !s1 ? s0 : !s0 ? s1 :
              closestPoint.date.getTime() - s0.date.getTime() > s1.date.getTime() - closestPoint.date.getTime() ? s1 : s0;

            if (closestShadow && closestShadow.mean !== undefined && !isNaN(closestShadow.mean) && isFinite(closestShadow.mean)) {
              // Check if shadow date is close to the current point date (within the aggregation period)
              const timeDiff = Math.abs(closestShadow.date.getTime() - closestPoint.date.getTime());
              const maxDiff = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
              if (timeDiff < maxDiff) {
                shadowValue = closestShadow.mean;
                shadowExists = true;
              }
            }
          } else if (shadowsDataWithValues.length > 0) {
            const firstShadow = shadowsDataWithValues[0];
            const shadowBisect = d3.bisector((d: any) => d.date).left;
            const shadowIndex = shadowBisect(firstShadow.data, closestPoint.date);
            const s0 = firstShadow.data[shadowIndex - 1];
            const s1 = firstShadow.data[shadowIndex];
            const closestShadow = !s1 ? s0 : !s0 ? s1 :
              closestPoint.date.getTime() - s0.date.getTime() > s1.date.getTime() - closestPoint.date.getTime() ? s1 : s0;

            if (closestShadow && !isNaN(closestShadow.value) && isFinite(closestShadow.value)) {
              // Check if shadow date is close to the current point date
              const timeDiff = Math.abs(closestShadow.date.getTime() - closestPoint.date.getTime());
              const maxDiff = 7 * 24 * 60 * 60 * 1000; // 7 days
              if (timeDiff < maxDiff) {
                shadowValue = closestShadow.value;
                shadowExists = true;
              }
            }
          }

          if (shadowValue !== undefined && shadowExists) {
            const shadowY = yScale(shadowValue);
            const shadowText = shadowValue.toFixed(2);
            const shadowTextWidth = shadowText.length * 6 + 4;

            hoverCircleShadow
              .attr('cx', x)
              .attr('cy', shadowY);

            hoverTextBgShadow
              .attr('x', x + 5)
              .attr('y', shadowY - 16)
              .attr('width', shadowTextWidth)
              .attr('height', 12);

            hoverLabelShadow
              .attr('x', x + 6)
              .attr('y', shadowY - 6)
              .text(shadowText);

            hoverGroupShadow.style('opacity', 1);
          } else {
            hoverGroupShadow.style('opacity', 0);
          }
        } else {
          hoverGroupShadow.style('opacity', 0);
        }

        // Show forecast hover if expanded and in forecast period
        if (showXAxis && forecastData.length > 0) {
          const lastDataDate = displayData[displayData.length - 1]?.date;
          const isForecastPeriod = lastDataDate && hoveredDate > lastDataDate;

          if (isForecastPeriod) {
            const forecastBisect = d3.bisector((d: any) => d.date).left;
            const forecastIndex = forecastBisect(forecastData, hoveredDate);
            const f0 = forecastData[forecastIndex - 1];
            const f1 = forecastData[forecastIndex];
            const closestForecast = !f1 ? f0 : !f0 ? f1 :
              hoveredDate.getTime() - f0.date.getTime() > f1.date.getTime() - hoveredDate.getTime() ? f1 : f0;

            if (closestForecast) {
              const forecastX = xScale(closestForecast.date);
              const forecastY = yScale(closestForecast.value);
              const forecastText = closestForecast.value.toFixed(2);
              const forecastTextWidth = forecastText.length * 6 + 4;

              hoverCircleForecast
                .attr('cx', forecastX)
                .attr('cy', forecastY);

              hoverTextBgForecast
                .attr('x', forecastX + 5)
                .attr('y', forecastY - 16)
                .attr('width', forecastTextWidth)
                .attr('height', 12);

              hoverLabelForecast
                .attr('x', forecastX + 6)
                .attr('y', forecastY - 6)
                .text(forecastText);

              hoverGroupForecast.style('opacity', 1);
              hoverGroup.style('opacity', 0); // Hide main series in forecast period
            } else {
              hoverGroupForecast.style('opacity', 0);
            }
          } else {
            hoverGroupForecast.style('opacity', 0);
          }
        } else {
          hoverGroupForecast.style('opacity', 0);
        }

        if (onHover) {
          onHover(closestPoint.date);
        }
      }
    });

    overlay.on('mouseout', function() {
      hoverLine.style('opacity', 0);
      hoverGroup.style('opacity', 0);
      hoverGroupGoal.style('opacity', 0);
      hoverGroupForecast.style('opacity', 0);
      hoverGroupShadow.style('opacity', 0);
      if (onHover) {
        onHover(null);
      }
    });

    // Handle click to update selection
    overlay.on('click', function(event) {
      const [mouseX] = d3.pointer(event);
      const clickedDate = xScale.invert(mouseX);

      // Combine display data and forecast data for selection
      const allSelectableData = [...displayData, ...forecastData];

      // Find closest data point (including forecast)
      const bisect = d3.bisector((d: any) => d.date).left;
      const index = bisect(allSelectableData, clickedDate);
      const d0 = allSelectableData[index - 1];
      const d1 = allSelectableData[index];
      const closestPoint = !d1 ? d0 : !d0 ? d1 :
        clickedDate.getTime() - d0.date.getTime() > d1.date.getTime() - clickedDate.getTime() ? d1 : d0;

      if (closestPoint && onClick) {
        onClick(closestPoint.date);
      }
    });

    // Show hover indicators from parent (synchronized across all charts)
    if (currentHoverDate) {
      // Combine display data and forecast data for hover
      const allHoverableData = [...displayData, ...forecastData];

      const bisect = d3.bisector((d: any) => d.date).left;
      const index = bisect(allHoverableData, currentHoverDate);
      const d0 = allHoverableData[index - 1];
      const d1 = allHoverableData[index];
      const closestPoint = !d1 ? d0 : !d0 ? d1 :
        currentHoverDate.getTime() - d0.date.getTime() > d1.date.getTime() - currentHoverDate.getTime() ? d1 : d0;

      if (closestPoint) {
        const x = xScale(closestPoint.date);
        const y = yScale(closestPoint.value);

        hoverLine
          .attr('x1', x)
          .attr('x2', x)
          .style('opacity', 1);

        hoverCircle
          .attr('cx', x)
          .attr('cy', y);

        // Position text to upper-right of circle
        const labelText = closestPoint.value.toFixed(2);
        const textWidth = labelText.length * 6 + 4; // Approximate width

        hoverTextBg
          .attr('x', x + 5)
          .attr('y', y - 16)
          .attr('width', textWidth)
          .attr('height', 12);

        hoverLabel
          .attr('x', x + 6)
          .attr('y', y - 6)
          .text(labelText);

        hoverGroup.style('opacity', 1);

        // Also show goal, shadow, forecast hovers in synchronized mode if expanded
        if (showXAxis) {
          // Goal hover
          if (goals && goals.length > 0) {
            const goalsData = generateGoalsData(series.data, goals);
            const firstGoalData = goalsData[0];
            if (firstGoalData) {
              const goalBisect = d3.bisector((d: any) => d.date).left;
              const goalIndex = goalBisect(firstGoalData.data, closestPoint.date);
              const g0 = firstGoalData.data[goalIndex - 1];
              const g1 = firstGoalData.data[goalIndex];
              const closestGoal = !g1 ? g0 : !g0 ? g1 :
                closestPoint.date.getTime() - g0.date.getTime() > g1.date.getTime() - closestPoint.date.getTime() ? g1 : g0;

              if (closestGoal) {
                const goalValue = closestGoal.numerator / closestGoal.denominator;
                const goalY = yScale(goalValue);
                const goalText = goalValue.toFixed(2);
                const goalTextWidth = goalText.length * 6 + 4;

                hoverCircleGoal.attr('cx', x).attr('cy', goalY).attr('fill', firstGoalData.color);
                hoverTextBgGoal.attr('x', x + 5).attr('y', goalY - 16).attr('width', goalTextWidth).attr('height', 12);
                hoverLabelGoal.attr('x', x + 6).attr('y', goalY - 6).text(goalText).attr('fill', firstGoalData.color);
                hoverGroupGoal.style('opacity', 1);
              } else {
                hoverGroupGoal.style('opacity', 0);
              }
            } else {
              hoverGroupGoal.style('opacity', 0);
            }
          } else {
            hoverGroupGoal.style('opacity', 0);
          }

          // Shadow hover
          if (averagedShadowData.length > 0 || shadowsDataWithValues.length > 0) {
            let shadowValue: number | undefined;
            let shadowExists = false;

            if (averageShadows && averagedShadowData.length > 0) {
              const shadowBisect = d3.bisector((d: any) => d.date).left;
              const shadowIndex = shadowBisect(averagedShadowData, closestPoint.date);
              const s0 = averagedShadowData[shadowIndex - 1];
              const s1 = averagedShadowData[shadowIndex];
              const closestShadow = !s1 ? s0 : !s0 ? s1 :
                closestPoint.date.getTime() - s0.date.getTime() > s1.date.getTime() - closestPoint.date.getTime() ? s1 : s0;

              if (closestShadow && closestShadow.mean !== undefined && !isNaN(closestShadow.mean) && isFinite(closestShadow.mean)) {
                const timeDiff = Math.abs(closestShadow.date.getTime() - closestPoint.date.getTime());
                const maxDiff = 7 * 24 * 60 * 60 * 1000;
                if (timeDiff < maxDiff) {
                  shadowValue = closestShadow.mean;
                  shadowExists = true;
                }
              }
            } else if (shadowsDataWithValues.length > 0) {
              const firstShadow = shadowsDataWithValues[0];
              const shadowBisect = d3.bisector((d: any) => d.date).left;
              const shadowIndex = shadowBisect(firstShadow.data, closestPoint.date);
              const s0 = firstShadow.data[shadowIndex - 1];
              const s1 = firstShadow.data[shadowIndex];
              const closestShadow = !s1 ? s0 : !s0 ? s1 :
                closestPoint.date.getTime() - s0.date.getTime() > s1.date.getTime() - closestPoint.date.getTime() ? s1 : s0;

              if (closestShadow && !isNaN(closestShadow.value) && isFinite(closestShadow.value)) {
                const timeDiff = Math.abs(closestShadow.date.getTime() - closestPoint.date.getTime());
                const maxDiff = 7 * 24 * 60 * 60 * 1000;
                if (timeDiff < maxDiff) {
                  shadowValue = closestShadow.value;
                  shadowExists = true;
                }
              }
            }

            if (shadowValue !== undefined && shadowExists) {
              const shadowY = yScale(shadowValue);
              const shadowText = shadowValue.toFixed(2);
              const shadowTextWidth = shadowText.length * 6 + 4;

              hoverCircleShadow.attr('cx', x).attr('cy', shadowY);
              hoverTextBgShadow.attr('x', x + 5).attr('y', shadowY - 16).attr('width', shadowTextWidth).attr('height', 12);
              hoverLabelShadow.attr('x', x + 6).attr('y', shadowY - 6).text(shadowText);
              hoverGroupShadow.style('opacity', 1);
            } else {
              hoverGroupShadow.style('opacity', 0);
            }
          } else {
            hoverGroupShadow.style('opacity', 0);
          }
        } else {
          hoverGroupGoal.style('opacity', 0);
          hoverGroupShadow.style('opacity', 0);
        }
      }
    } else {
      hoverLine.style('opacity', 0);
      hoverGroup.style('opacity', 0);
      hoverGroupGoal.style('opacity', 0);
      hoverGroupShadow.style('opacity', 0);
      hoverGroupForecast.style('opacity', 0);
    }

  }, [series, aggregationConfig, shadows, averageShadows, forecastConfig, focusPeriod, goals, xDomain, width, height, showXAxis, selectionDate, currentHoverDate, onHover, onClick, onZoom]);

  return <svg ref={svgRef} className="w-full" />;
}
