import type { DateRange } from '../components/RangeControls';

/**
 * Get the end date of the quarter for a given date
 */
function getEndOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  const endOfQuarter = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
  endOfQuarter.setHours(23, 59, 59, 999);
  return endOfQuarter;
}

/**
 * Calculate the actual date range based on preset or custom dates
 * Always extends to end of quarter for the selected period
 */
export function calculateDateRange(range: DateRange | undefined, dataExtent?: [Date, Date]): [Date, Date] | undefined {
  if (!range || range.preset === 'all') {
    return dataExtent; // No range specified or 'all' preset, use full data extent
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
      // Keep the exact dates selected by the user
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
        // Extend to end of current quarter
        endDate = getEndOfQuarter(today);
        break;
      }
      case 'YTD': {
        // Year to Date - start of current year
        startDate = new Date(today.getFullYear(), 0, 1);
        // Extend to end of quarter containing today
        endDate = getEndOfQuarter(today);
        break;
      }
      default:
        return dataExtent;
    }
  }

  // Ensure start date is normalized
  startDate.setHours(0, 0, 0, 0);

  return [startDate, endDate];
}
