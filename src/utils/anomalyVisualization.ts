/**
 * Anomaly visualization utilities for D3 charts
 * To be integrated into TimeSeriesChart.tsx
 */

import { select, Selection } from 'd3-selection';
import { ScaleTime, ScaleLinear } from 'd3-scale';
import { area as d3Area, curveLinear } from 'd3-shape';
import type { AnomalyPoint, ConfidenceBand, AnomalyResult } from '../types/anomaly';

/**
 * Render confidence bands (shaded area showing expected range)
 */
export function renderConfidenceBands(
  svg: Selection<SVGGElement, unknown, null, undefined>,
  confidenceBands: ConfidenceBand[],
  xScale: ScaleTime<number, number>,
  yScale: ScaleLinear<number, number>,
  color: string = 'red',
  opacity: number = 0.1
): void {
  // Create area generator for confidence band
  const areaGenerator = d3Area<ConfidenceBand>()
    .x(d => xScale(d.date))
    .y0(d => yScale(d.lower))
    .y1(d => yScale(d.upper))
    .curve(curveLinear);

  // Remove existing confidence bands
  svg.selectAll('.confidence-band').remove();

  // Render confidence band
  svg.append('path')
    .datum(confidenceBands)
    .attr('class', 'confidence-band')
    .attr('d', areaGenerator)
    .attr('fill', color)
    .attr('opacity', opacity)
    .attr('pointer-events', 'none');
}

/**
 * Render anomaly points as circles
 */
export function renderAnomalyPoints(
  svg: Selection<SVGGElement, unknown, null, undefined>,
  anomalies: AnomalyPoint[],
  xScale: ScaleTime<number, number>,
  yScale: ScaleLinear<number, number>,
  onHover?: (anomaly: AnomalyPoint, event: MouseEvent) => void,
  onLeave?: () => void
): void {
  // Remove existing anomaly points
  svg.selectAll('.anomaly-point').remove();

  // Render anomaly points
  const anomalyPoints = svg.selectAll('.anomaly-point')
    .data(anomalies)
    .enter()
    .append('circle')
    .attr('class', 'anomaly-point')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.value))
    .attr('r', 5)
    .attr('fill', d => getSeverityColor(d.severity))
    .attr('stroke', 'white')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .style('opacity', 0.9);

  // Add hover interactions
  if (onHover) {
    anomalyPoints.on('mouseover', function(event, d) {
      select(this)
        .transition()
        .duration(200)
        .attr('r', 7)
        .style('opacity', 1);

      onHover(d, event);
    });
  }

  if (onLeave) {
    anomalyPoints.on('mouseout', function() {
      select(this)
        .transition()
        .duration(200)
        .attr('r', 5)
        .style('opacity', 0.9);

      onLeave();
    });
  }
}

/**
 * Get color for anomaly severity
 */
function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return '#FFA500'; // Orange
    case 'medium':
      return '#FF6B6B'; // Red-orange
    case 'high':
      return '#DC2626'; // Dark red
    default:
      return '#EF4444'; // Red
  }
}

/**
 * Format anomaly tooltip content
 */
export function formatAnomalyTooltip(anomaly: AnomalyPoint): string {
  const dateStr = anomaly.date.toLocaleDateString();
  const { lower, upper } = anomaly.expectedRange;

  return `
    <div style="font-size: 12px; line-height: 1.5;">
      <div style="font-weight: bold; color: #DC2626; margin-bottom: 4px;">
        ⚠️ Anomaly Detected
      </div>
      <div><strong>Date:</strong> ${dateStr}</div>
      <div><strong>Value:</strong> ${anomaly.value.toFixed(2)}</div>
      <div><strong>Expected Range:</strong> ${lower.toFixed(2)} - ${upper.toFixed(2)}</div>
      <div><strong>Severity:</strong> <span style="color: ${getSeverityColor(anomaly.severity)}">${anomaly.severity.toUpperCase()}</span></div>
      <div style="font-size: 11px; color: #666; margin-top: 4px;">
        Deviation: ${anomaly.deviation.toFixed(2)}σ
      </div>
    </div>
  `;
}

/**
 * Example integration into TimeSeriesChart
 *
 * Add these props to TimeSeriesChartProps:
 * ```typescript
 * anomalyResult?: AnomalyResult;
 * anomalyConfig?: AnomalyConfig;
 * ```
 *
 * In the chart rendering code, after rendering the main line:
 * ```typescript
 * // Render confidence bands
 * if (anomalyConfig?.showConfidenceBands && anomalyResult?.confidenceBands) {
 *   renderConfidenceBands(
 *     svg,
 *     anomalyResult.confidenceBands,
 *     xScale,
 *     yScale,
 *     'red',
 *     0.1
 *   );
 * }
 *
 * // Render anomaly points
 * if (anomalyResult?.anomalies) {
 *   renderAnomalyPoints(
 *     svg,
 *     anomalyResult.anomalies,
 *     xScale,
 *     yScale,
 *     (anomaly, event) => {
 *       // Show tooltip
 *       showTooltip(event, formatAnomalyTooltip(anomaly));
 *     },
 *     () => {
 *       // Hide tooltip
 *       hideTooltip();
 *     }
 *   );
 * }
 * ```
 */
