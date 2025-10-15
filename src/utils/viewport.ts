import { subYears, subMonths, subWeeks } from 'date-fns';
import type { Viewport, ZoomPreset } from '../types/viewport';

/**
 * Get the full date range from data
 */
export function getFullDateRange(data: Array<{ date: Date }>): [Date, Date] {
  if (data.length === 0) {
    const now = new Date();
    return [now, now];
  }

  const dates = data.map(d => d.date);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  return [minDate, maxDate];
}

/**
 * Apply viewport to get visible date range
 */
export function getVisibleDateRange(
  fullRange: [Date, Date],
  viewport: Viewport
): [Date, Date] {
  const [minDate, maxDate] = fullRange;

  const startDate = viewport.startDate || minDate;
  const endDate = viewport.endDate || maxDate;

  return [startDate, endDate];
}

/**
 * Create viewport from zoom preset
 */
export function createViewportFromPreset(
  preset: ZoomPreset,
  fullRange: [Date, Date]
): Viewport {
  const [, maxDate] = fullRange;

  switch (preset) {
    case 'all':
      return { startDate: null, endDate: null };
    case 'year':
      return { startDate: subYears(maxDate, 1), endDate: null };
    case 'quarter':
      return { startDate: subMonths(maxDate, 3), endDate: null };
    case 'month':
      return { startDate: subMonths(maxDate, 1), endDate: null };
    case 'week':
      return { startDate: subWeeks(maxDate, 1), endDate: null };
  }
}

/**
 * Pan viewport by a percentage of current range
 */
export function panViewport(
  viewport: Viewport,
  fullRange: [Date, Date],
  panPercent: number
): Viewport {
  const [fullMin, fullMax] = fullRange;
  const [currentStart, currentEnd] = getVisibleDateRange(fullRange, viewport);

  const rangeMs = currentEnd.getTime() - currentStart.getTime();
  const panMs = rangeMs * panPercent;

  let newStart = new Date(currentStart.getTime() + panMs);
  let newEnd = new Date(currentEnd.getTime() + panMs);

  // Clamp to full range
  if (newStart < fullMin) {
    const diff = fullMin.getTime() - newStart.getTime();
    newStart = fullMin;
    newEnd = new Date(newEnd.getTime() + diff);
  }
  if (newEnd > fullMax) {
    const diff = newEnd.getTime() - fullMax.getTime();
    newEnd = fullMax;
    newStart = new Date(newStart.getTime() - diff);
  }

  // Clamp start again if needed
  if (newStart < fullMin) newStart = fullMin;

  return {
    startDate: newStart,
    endDate: newEnd
  };
}

/**
 * Zoom viewport in or out
 */
export function zoomViewport(
  viewport: Viewport,
  fullRange: [Date, Date],
  zoomFactor: number // > 1 = zoom in, < 1 = zoom out
): Viewport {
  const [fullMin, fullMax] = fullRange;
  const [currentStart, currentEnd] = getVisibleDateRange(fullRange, viewport);

  const currentRangeMs = currentEnd.getTime() - currentStart.getTime();
  const newRangeMs = currentRangeMs / zoomFactor;

  // Keep center point the same
  const centerMs = (currentStart.getTime() + currentEnd.getTime()) / 2;

  let newStart = new Date(centerMs - newRangeMs / 2);
  let newEnd = new Date(centerMs + newRangeMs / 2);

  // Clamp to full range
  if (newStart < fullMin) newStart = fullMin;
  if (newEnd > fullMax) newEnd = fullMax;

  // If we're showing the full range or more, return null viewport
  if (newStart <= fullMin && newEnd >= fullMax) {
    return { startDate: null, endDate: null };
  }

  return {
    startDate: newStart,
    endDate: newEnd
  };
}
