import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Series } from '../types/series';
import type { AggregationConfig } from '../utils/aggregation';
import type { ForecastConfig } from '../types/forecast';
import type { FocusPeriod } from '../types/focusPeriod';
import type { Shadow } from '../types/shadow';
import { applyAggregation, normalizeSelectionDate } from '../utils/aggregation';
import { generateForecast } from '../utils/forecasting';
import { generateShadowsData, calculateShadowAverage } from '../utils/shadows';

interface CompactTimeSeriesChartProps {
  series: Series;
  aggregationConfig?: AggregationConfig;
  shadows?: Shadow[];
  averageShadows?: boolean;
  forecastConfig?: ForecastConfig;
  focusPeriod?: FocusPeriod;
  xDomain: [Date, Date];
  width: number;
  height?: number;
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
  xDomain,
  width,
  height = 72,
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

    const margin = { top: 5, right: 5, bottom: 0, left: 40 };
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

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(allValues) as number * 1.1])
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

    // Y-axis (minimal)
    const yAxis = d3.axisLeft(yScale).ticks(3).tickSize(3);
    g.append('g')
      .attr('class', 'y-axis')
      .style('font-size', '9px')
      .call(yAxis);

    // Selection line (solid, persistent - shows locked selection)
    const selectionLine = g.append('line')
      .attr('stroke', '#000000')
      .attr('stroke-width', 1)
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

    // Hover circle and label group
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

      // Find closest data point
      const bisect = d3.bisector((d: any) => d.date).left;
      const index = bisect(displayData, hoveredDate);
      const d0 = displayData[index - 1];
      const d1 = displayData[index];
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

        if (onHover) {
          onHover(closestPoint.date);
        }
      }
    });

    overlay.on('mouseout', function() {
      hoverLine.style('opacity', 0);
      hoverGroup.style('opacity', 0);
      if (onHover) {
        onHover(null);
      }
    });

    // Handle click to update selection
    overlay.on('click', function(event) {
      const [mouseX] = d3.pointer(event);
      const clickedDate = xScale.invert(mouseX);

      // Find closest data point
      const bisect = d3.bisector((d: any) => d.date).left;
      const index = bisect(displayData, clickedDate);
      const d0 = displayData[index - 1];
      const d1 = displayData[index];
      const closestPoint = !d1 ? d0 : !d0 ? d1 :
        clickedDate.getTime() - d0.date.getTime() > d1.date.getTime() - clickedDate.getTime() ? d1 : d0;

      if (closestPoint && onClick) {
        onClick(closestPoint.date);
      }
    });

    // Show hover indicators from parent (synchronized across all charts)
    if (currentHoverDate) {
      const bisect = d3.bisector((d: any) => d.date).left;
      const index = bisect(displayData, currentHoverDate);
      const d0 = displayData[index - 1];
      const d1 = displayData[index];
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
      }
    } else {
      hoverLine.style('opacity', 0);
      hoverGroup.style('opacity', 0);
    }

  }, [series, aggregationConfig, shadows, averageShadows, forecastConfig, focusPeriod, xDomain, width, height, selectionDate, currentHoverDate, onHover, onClick, onZoom]);

  return <svg ref={svgRef} className="w-full" />;
}
