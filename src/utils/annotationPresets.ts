import type { AnnotationPreset, PresetGenerationParams } from '../types/annotation';
import { createEventAnnotation, createRangeAnnotation } from './annotations';

/**
 * Calculate nth weekday of a month
 * Example: 3rd Monday in January
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();

  // Calculate days until target weekday
  let daysUntilWeekday = (weekday - firstWeekday + 7) % 7;

  // Add weeks
  const targetDay = 1 + daysUntilWeekday + (n - 1) * 7;

  return new Date(year, month, targetDay);
}

/**
 * Calculate last weekday of a month
 * Example: Last Monday in May (Memorial Day)
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  // Start from last day of month and work backwards
  const lastDay = new Date(year, month + 1, 0);
  const lastDayWeekday = lastDay.getDay();

  let daysBack = (lastDayWeekday - weekday + 7) % 7;

  return new Date(year, month, lastDay.getDate() - daysBack);
}

/**
 * Generate US Federal Holidays preset for a given year range
 */
export function generateUSHolidaysPreset(params: PresetGenerationParams): AnnotationPreset {
  const { startYear, endYear } = params;
  const annotations = [];

  for (let year = startYear; year <= endYear; year++) {
    // New Year's Day - January 1
    annotations.push(
      createEventAnnotation(
        new Date(year, 0, 1),
        "New Year's Day",
        { description: "Federal Holiday" }
      )
    );

    // Martin Luther King Jr. Day - 3rd Monday in January
    annotations.push(
      createEventAnnotation(
        getNthWeekdayOfMonth(year, 0, 1, 3),
        "Martin Luther King Jr. Day",
        { description: "Federal Holiday" }
      )
    );

    // Presidents' Day - 3rd Monday in February
    annotations.push(
      createEventAnnotation(
        getNthWeekdayOfMonth(year, 1, 1, 3),
        "Presidents' Day",
        { description: "Federal Holiday" }
      )
    );

    // Memorial Day - Last Monday in May
    annotations.push(
      createEventAnnotation(
        getLastWeekdayOfMonth(year, 4, 1),
        "Memorial Day",
        { description: "Federal Holiday" }
      )
    );

    // Juneteenth - June 19
    if (year >= 2021) { // Became federal holiday in 2021
      annotations.push(
        createEventAnnotation(
          new Date(year, 5, 19),
          "Juneteenth",
          { description: "Federal Holiday" }
        )
      );
    }

    // Independence Day - July 4
    annotations.push(
      createEventAnnotation(
        new Date(year, 6, 4),
        "Independence Day",
        { description: "Federal Holiday" }
      )
    );

    // Labor Day - 1st Monday in September
    annotations.push(
      createEventAnnotation(
        getNthWeekdayOfMonth(year, 8, 1, 1),
        "Labor Day",
        { description: "Federal Holiday" }
      )
    );

    // Columbus Day / Indigenous Peoples' Day - 2nd Monday in October
    annotations.push(
      createEventAnnotation(
        getNthWeekdayOfMonth(year, 9, 1, 2),
        "Columbus Day",
        { description: "Federal Holiday" }
      )
    );

    // Veterans Day - November 11
    annotations.push(
      createEventAnnotation(
        new Date(year, 10, 11),
        "Veterans Day",
        { description: "Federal Holiday" }
      )
    );

    // Thanksgiving - 4th Thursday in November
    annotations.push(
      createEventAnnotation(
        getNthWeekdayOfMonth(year, 10, 4, 4),
        "Thanksgiving",
        { description: "Federal Holiday" }
      )
    );

    // Christmas Day - December 25
    annotations.push(
      createEventAnnotation(
        new Date(year, 11, 25),
        "Christmas Day",
        { description: "Federal Holiday" }
      )
    );
  }

  return {
    id: 'us-federal-holidays',
    name: 'US Federal Holidays',
    description: `US Federal Holidays from ${startYear} to ${endYear}`,
    category: 'holidays',
    annotations
  };
}

/**
 * Generate Major Shopping Events preset
 */
export function generateShoppingEventsPreset(params: PresetGenerationParams): AnnotationPreset {
  const { startYear, endYear } = params;
  const annotations = [];

  for (let year = startYear; year <= endYear; year++) {
    // Black Friday - Day after Thanksgiving (4th Thursday + 1 day)
    const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
    const blackFriday = new Date(thanksgiving);
    blackFriday.setDate(thanksgiving.getDate() + 1);

    annotations.push(
      createEventAnnotation(
        blackFriday,
        "Black Friday",
        { description: "Major Shopping Event" }
      )
    );

    // Cyber Monday - Monday after Thanksgiving
    const cyberMonday = new Date(thanksgiving);
    cyberMonday.setDate(thanksgiving.getDate() + 4);

    annotations.push(
      createEventAnnotation(
        cyberMonday,
        "Cyber Monday",
        { description: "Major Shopping Event" }
      )
    );

    // Prime Day - Typically mid-July (using July 15 as approximation)
    // Note: Actual dates vary; this is an estimate
    if (year >= 2015) { // Prime Day started in 2015
      annotations.push(
        createRangeAnnotation(
          new Date(year, 6, 14),
          new Date(year, 6, 16),
          "Prime Day",
          { description: "Amazon Prime Day (approximate)", opacity: 0.15 }
        )
      );
    }

    // Holiday Shopping Season - Thanksgiving through Christmas
    annotations.push(
      createRangeAnnotation(
        thanksgiving,
        new Date(year, 11, 25), // Christmas
        "Holiday Shopping Season",
        { description: "Peak retail season", opacity: 0.1 }
      )
    );
  }

  return {
    id: 'shopping-events',
    name: 'Major Shopping Events',
    description: `Major shopping events from ${startYear} to ${endYear}`,
    category: 'business',
    annotations
  };
}

/**
 * Generate Financial Calendar preset (Quarter ends)
 */
export function generateFinancialCalendarPreset(params: PresetGenerationParams): AnnotationPreset {
  const { startYear, endYear } = params;
  const annotations = [];

  for (let year = startYear; year <= endYear; year++) {
    // Q1 End - March 31
    annotations.push(
      createEventAnnotation(
        new Date(year, 2, 31),
        "Q1 End",
        { description: "End of Q1", style: 'dashed' }
      )
    );

    // Q2 End - June 30
    annotations.push(
      createEventAnnotation(
        new Date(year, 5, 30),
        "Q2 End",
        { description: "End of Q2", style: 'dashed' }
      )
    );

    // Q3 End - September 30
    annotations.push(
      createEventAnnotation(
        new Date(year, 8, 30),
        "Q3 End",
        { description: "End of Q3", style: 'dashed' }
      )
    );

    // Q4 End / Year End - December 31
    annotations.push(
      createEventAnnotation(
        new Date(year, 11, 31),
        "Q4 End / Year End",
        { description: "End of Q4 and Fiscal Year", style: 'dashed' }
      )
    );
  }

  return {
    id: 'financial-calendar',
    name: 'Financial Calendar (Quarter Ends)',
    description: `Quarter end dates from ${startYear} to ${endYear}`,
    category: 'financial',
    annotations
  };
}

/**
 * Get all available presets
 */
export function getAllPresets(params?: Partial<PresetGenerationParams>): AnnotationPreset[] {
  const currentYear = new Date().getFullYear();
  const defaultParams: PresetGenerationParams = {
    startYear: params?.startYear || currentYear - 1,
    endYear: params?.endYear || currentYear + 1,
    includeObservedDates: params?.includeObservedDates || false
  };

  return [
    generateUSHolidaysPreset(defaultParams),
    generateShoppingEventsPreset(defaultParams),
    generateFinancialCalendarPreset(defaultParams)
  ];
}

/**
 * Get a specific preset by ID
 */
export function getPresetById(
  presetId: string,
  params?: Partial<PresetGenerationParams>
): AnnotationPreset | null {
  const currentYear = new Date().getFullYear();
  const defaultParams: PresetGenerationParams = {
    startYear: params?.startYear || currentYear - 1,
    endYear: params?.endYear || currentYear + 1,
    includeObservedDates: params?.includeObservedDates || false
  };

  switch (presetId) {
    case 'us-federal-holidays':
      return generateUSHolidaysPreset(defaultParams);
    case 'shopping-events':
      return generateShoppingEventsPreset(defaultParams);
    case 'financial-calendar':
      return generateFinancialCalendarPreset(defaultParams);
    default:
      return null;
  }
}
