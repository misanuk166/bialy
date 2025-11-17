import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Series } from '../types/series';
import type { AggregationConfig } from '../utils/aggregation';
import type { ForecastConfig } from '../types/forecast';
import type { FocusPeriod } from '../types/focusPeriod';
import { applyAggregation } from '../utils/aggregation';
import { generateForecast } from '../utils/forecasting';

interface CompactTimeSeriesChartProps {
  series: Series;
  aggregationConfig?: AggregationConfig;
  forecastConfig?: ForecastConfig;
  focusPeriod?: FocusPeriod;
  xDomain: [Date, Date];
  width: number;
  height?: number;
  currentHoverDate?: Date;
  onHover?: (date: Date | null) => void;
  onZoom?: (domain: [Date, Date]) => void;
}

export function CompactTimeSeriesChart({
  series,
  aggregationConfig,
  forecastConfig,
  focusPeriod,
  xDomain,
  width,
  height = 90,
  currentHoverDate,
  onHover,
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

    // Draw primary series line
    const line = d3.line<{ date: Date; value: number }>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveLinear);

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

    // Hover line
    const hoverLine = g.append('line')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

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

      hoverLine
        .attr('x1', mouseX)
        .attr('x2', mouseX)
        .style('opacity', 1);

      if (onHover) {
        onHover(hoveredDate);
      }
    });

    overlay.on('mouseout', function() {
      hoverLine.style('opacity', 0);
      if (onHover) {
        onHover(null);
      }
    });

    // Show current hover date from parent
    if (currentHoverDate) {
      const x = xScale(currentHoverDate);
      hoverLine
        .attr('x1', x)
        .attr('x2', x)
        .style('opacity', 1);
    }

  }, [series, aggregationConfig, forecastConfig, focusPeriod, xDomain, width, height, currentHoverDate, onHover, onZoom]);

  return <svg ref={svgRef} className="w-full" />;
}
