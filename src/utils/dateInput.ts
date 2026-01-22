/**
 * Utility functions for handling HTML date inputs without timezone issues.
 *
 * The problem: When you use `new Date("2024-11-01")`, JavaScript interprets this as
 * UTC midnight, which can shift to a different day in local timezones. Similarly,
 * `toISOString()` always returns UTC time, causing dates to shift when displayed.
 *
 * These utilities ensure dates are parsed and formatted in local time, preventing
 * the feedback loop where typed values get distorted.
 */

/**
 * Parse a date string from an HTML date input (YYYY-MM-DD) into a Date object in local time.
 * This prevents timezone issues that occur when using `new Date(dateString)`.
 *
 * @param dateString - Date string in YYYY-MM-DD format from an HTML date input
 * @returns Date object in local time, or undefined if the input is empty or invalid
 *
 * @example
 * parseDateInputValue("2024-11-20") // Returns Date object for Nov 20, 2024 at 00:00 local time
 */
export function parseDateInputValue(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined;

  // Ensure we have a complete date string (YYYY-MM-DD = 10 characters minimum)
  // This prevents parsing incomplete dates while typing (e.g., "202-11-20" when typing "2025")
  if (dateString.length < 10) return undefined;

  const parts = dateString.split('-');
  if (parts.length !== 3) return undefined;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return undefined;

  // Validate year is 4 digits
  if (year < 1000 || year > 9999) return undefined;

  // Create date in local time, not UTC
  return new Date(year, month, day);
}

/**
 * Format a Date object for an HTML date input (YYYY-MM-DD) in local time.
 * This prevents timezone issues that occur when using `toISOString()`.
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format, or empty string if date is undefined
 *
 * @example
 * formatDateForInput(new Date(2024, 10, 20)) // Returns "2024-11-20"
 */
export function formatDateForInput(date?: Date): string {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
