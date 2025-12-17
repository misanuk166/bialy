import type { Shadow, ShadowPeriodUnit } from '../types/shadow';
import type { ComparisonConfig } from '../types/comparison';

/**
 * Generate a concise label for a shadow period
 * Examples: "1Y ago", "2Q ago", "3M ago", "2W ago", "7D ago"
 */
export function generateShadowPeriodLabel(shadow: Shadow): string {
  const { periods, unit } = shadow;

  // Map unit to short form
  const unitShort: Record<ShadowPeriodUnit, string> = {
    'day': 'D',
    'week': 'W',
    'month': 'M',
    'quarter': 'Q',
    'year': 'Y'
  };

  return `vs ${periods}${unitShort[unit]} ago`;
}

/**
 * Generate a verbose label for a shadow period
 * Examples: "vs 1 Year ago", "vs 2 Quarters ago", "vs 3 Months ago"
 */
export function generateShadowPeriodLabelVerbose(shadow: Shadow): string {
  const { periods, unit } = shadow;

  // Pluralize if needed
  const unitLabel = periods === 1
    ? unit.charAt(0).toUpperCase() + unit.slice(1)
    : unit.charAt(0).toUpperCase() + unit.slice(1) + 's';

  return `vs ${periods} ${unitLabel} ago`;
}

/**
 * Update comparison labels based on current shadow configurations
 * This ensures comparison labels stay in sync with shadow periods
 */
export function updateComparisonLabelsForShadows(
  comparisons: ComparisonConfig[],
  shadows: Shadow[]
): ComparisonConfig[] {
  const enabledShadows = shadows.filter(s => s.enabled);

  return comparisons.map(comp => {
    // Only update shadow comparisons
    if (comp.type !== 'shadow') {
      return comp;
    }

    // Find the target shadow
    const targetIndex = comp.targetIndex ?? 0;
    const targetShadow = enabledShadows[targetIndex];

    if (!targetShadow) {
      // No shadow available, keep original label
      return comp;
    }

    // Generate new label based on shadow configuration
    const newLabel = generateShadowPeriodLabel(targetShadow);

    return {
      ...comp,
      label: newLabel
    };
  });
}
