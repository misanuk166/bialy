import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Series, TimeSeriesPoint } from '../types/series';
import type { SmoothingConfig } from '../utils/smoothing';
import type { Shadow } from '../types/shadow';
import { calculateRollingAverage } from '../utils/smoothing';
import { generateShadowsData } from '../utils/shadows';

interface TimeSeriesChartProps {
  series: Series;
  smoothingConfig?: SmoothingConfig;
  shadows?: Shadow[];
  width?: number;
  height?: number;
}

interface HoverData {
  date: string;
  value: number;
}

export function TimeSeriesChart({
  series,
  smoothingConfig,
  shadows = [],
  width = 900,
  height = 500
}: TimeSeriesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [currentDomain, setCurrentDomain] = useState<[Date, Date] | null>(null);

  useEffect(() => {
    if (!svgRef.current || !series.data.length) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up margins
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate values (numerator / denominator)
    const dataWithValues = series.data.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));

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

    // Generate shadow data
    const shadowsData = generateShadowsData(series.data, shadows);

    // Create scales - use smoothed data for domain if available
    const displayData = smoothingConfig?.enabled && smoothedDataWithValues.length > 0
      ? smoothedDataWithValues
      : dataWithValues;

    // Get full extent and use current domain if zoomed
    const fullExtent = d3.extent(dataWithValues, d => d.date) as [Date, Date];
    const initialDomain = currentDomain || fullExtent;

    const xScale = d3
      .scaleTime()
      .domain(initialDomain)
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(dataWithValues, d => d.value) as number * 1.1])
      .range([innerHeight, 0]);

    // Create line generator
    const line = d3
      .line<typeof dataWithValues[0]>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Draw axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    // Draw shadows (in order, so further back appears lighter)
    shadowsData.forEach(shadowData => {
      const shadowValues = shadowData.data
        .map(d => ({
          date: d.date,
          value: d.numerator / d.denominator
        }))
        .filter(d => !isNaN(d.value) && isFinite(d.value));

      if (shadowValues.length > 0) {
        g.append('path')
          .datum(shadowValues)
          .attr('class', `shadow-line-${shadowData.shadow.id}`)
          .attr('fill', 'none')
          .attr('stroke', shadowData.color)
          .attr('stroke-width', 2)
          .attr('opacity', 0.7)
          .attr('d', line);
      }
    });

    // If smoothing is enabled, draw original data as points
    if (smoothingConfig?.enabled && smoothedDataWithValues.length > 0) {
      g.selectAll('.data-point')
        .data(dataWithValues)
        .enter()
        .append('circle')
        .attr('class', 'data-point')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.value))
        .attr('r', 3)
        .attr('fill', '#93c5fd')
        .attr('opacity', 0.6);

      // Draw smoothed line
      g.append('path')
        .datum(smoothedDataWithValues)
        .attr('class', 'smoothed-line')
        .attr('fill', 'none')
        .attr('stroke', '#2563eb')
        .attr('stroke-width', 2)
        .attr('d', line);
    } else {
      // Draw regular line (no smoothing)
      g.append('path')
        .datum(dataWithValues)
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', '#2563eb')
        .attr('stroke-width', 2)
        .attr('d', line);
    }

    // Create overlay for hover interactions
    const overlay = g
      .append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all');

    // Create hover line
    const hoverLine = g
      .append('line')
      .attr('class', 'hover-line')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    // Create hover circle
    const hoverCircle = g
      .append('circle')
      .attr('class', 'hover-circle')
      .attr('r', 5)
      .attr('fill', '#2563eb')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Bisector for finding closest data point
    const bisect = d3.bisector<typeof dataWithValues[0], Date>(d => d.date).left;

    // Mouse move handler
    overlay.on('mousemove', function(event) {
      const [mouseX] = d3.pointer(event);
      const x0 = xScale.invert(mouseX);
      const index = bisect(displayData, x0, 1);
      const d0 = displayData[index - 1];
      const d1 = displayData[index];

      // Find closest point
      const d = !d1 ? d0 : x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;

      if (d) {
        const x = xScale(d.date);
        const y = yScale(d.value);

        hoverLine
          .attr('x1', x)
          .attr('x2', x)
          .style('opacity', 1);

        hoverCircle
          .attr('cx', x)
          .attr('cy', y)
          .style('opacity', 1);

        setHoverData({
          date: d.date.toLocaleDateString(),
          value: d.value
        });
      }
    });

    overlay.on('mouseout', function() {
      hoverLine.style('opacity', 0);
      hoverCircle.style('opacity', 0);
      setHoverData(null);
    });

    // Add brush for click-drag zoom selection
    const brush = d3.brushX()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .filter(function(event) {
        // Don't allow brush when shift key is held
        return !event.shiftKey;
      })
      .on('end', function(event) {
        if (!event.selection) return;

        const [x0, x1] = event.selection as [number, number];
        const newDomain = [xScale.invert(x0), xScale.invert(x1)] as [Date, Date];

        // Remove brush selection
        brushGroup.call(brush.move as any, null);

        // Update domain
        xScale.domain(newDomain);
        setCurrentDomain(newDomain);

        updateChart();
      });

    const brushGroup = g.append('g')
      .attr('class', 'brush')
      .call(brush);

    // Shift + click + drag for panning
    svg.on('mousedown', function(event) {
      if (!event.shiftKey) return;

      event.preventDefault();

      const startX = event.clientX;
      const startDomain = xScale.domain() as [Date, Date];
      const startDomainMs = [startDomain[0].getTime(), startDomain[1].getTime()];
      const domainRange = startDomainMs[1] - startDomainMs[0];

      function onMouseMove(e: MouseEvent) {
        // Stop panning if shift key is released or mouse button released
        if (!e.shiftKey || e.buttons === 0) {
          cleanup();
          return;
        }

        const dx = e.clientX - startX;
        const dxScale = (dx / innerWidth) * domainRange;

        const newDomain = [
          new Date(startDomainMs[0] - dxScale),
          new Date(startDomainMs[1] - dxScale)
        ] as [Date, Date];

        // Clamp to full extent
        if (newDomain[0] < fullExtent[0]) {
          const shift = fullExtent[0].getTime() - newDomain[0].getTime();
          newDomain[0] = fullExtent[0];
          newDomain[1] = new Date(newDomain[1].getTime() + shift);
        }
        if (newDomain[1] > fullExtent[1]) {
          const shift = newDomain[1].getTime() - fullExtent[1].getTime();
          newDomain[1] = fullExtent[1];
          newDomain[0] = new Date(newDomain[0].getTime() - shift);
        }

        xScale.domain(newDomain);
        setCurrentDomain(newDomain);
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
      xScale.domain(fullExtent);
      updateChart();
    });

    // Function to update chart elements after zoom/pan
    function updateChart() {
      // Update x-axis
      g.select('.x-axis')
        .call(xAxis as any);

      // Update lines
      g.selectAll('.line, .smoothed-line')
        .attr('d', line as any);

      // Update shadows
      g.selectAll('[class^="shadow-line-"]')
        .attr('d', line as any);

      // Update points
      g.selectAll('.data-point')
        .attr('cx', (d: any) => xScale(d.date))
        .attr('cy', (d: any) => yScale(d.value));
    }

  }, [series, smoothingConfig, shadows, currentDomain, width, height]);

  return (
    <div className="relative">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{series.metadata.name}</h2>
          {series.metadata.description && (
            <p className="text-sm text-gray-600 mt-1">{series.metadata.description}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Click and drag to select zoom window • Shift+drag to pan • Double-click to reset
          </p>
        </div>
        <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm min-w-[240px]">
          {hoverData ? (
            <div className="font-mono">
              <div className="text-gray-600">Date: <span className="font-semibold text-gray-900">{hoverData.date}</span></div>
              <div className="text-gray-600">Value: <span className="font-semibold text-gray-900">{hoverData.value.toLocaleString()}</span></div>
            </div>
          ) : (
            <div className="font-mono text-gray-400">
              <div>Hover over chart</div>
              <div>&nbsp;</div>
            </div>
          )}
        </div>
      </div>
      <svg ref={svgRef} className="border border-gray-200 rounded-lg bg-white" />
    </div>
  );
}
