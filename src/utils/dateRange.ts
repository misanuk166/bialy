import type { DateRange } from '../components/RangeControls';

/**
 * Calculate the actual date range based on preset or custom dates
 */
export function calculateDateRange(range: DateRange | undefined, dataExtent?: [Date, Date]): [Date, Date] | undefined {
  if (!range) {
    return dataExtent; // No range specified, use full data extent
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let startDate: Date;
  let endDate: Date;

  if (range.preset === 'custom') {
    // Use custom dates if provided
    if (range.startDate && range.endDate) {
      startDate = new Date(range.startDate);
      endDate = new Date(range.endDate);
    } else {
      return dataExtent; // Fallback to full extent if custom dates not set
    }
  } else {
    // Calculate based on preset
    endDate = today;

    switch (range.preset) {
      case 'QTD': {
        // Quarter to Date - start of current quarter
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      }
      case 'YTD': {
        // Year to Date - start of current year
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      }
      case '12M': {
        // Last 12 months
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      }
      default:
        return dataExtent;
    }
  }

  // Ensure dates are normalized
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return [startDate, endDate];
}
