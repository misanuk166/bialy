import { scaleLinear } from 'd3-scale';
import { interpolateRgb } from 'd3-interpolate';

interface ColumnCellProps {
  value?: number | string;
  precision?: number;
  colorCode?: boolean;
  showSign?: boolean;
  isEmpty?: boolean;
  className?: string;
  bgClassName?: string;
  scaledColorPct?: number; // The percentage value used for gradient scaling
  maxPositivePct?: number; // Max positive percentage in the dataset
  maxNegativePct?: number; // Max negative percentage (most negative)
  isExtreme?: boolean; // True if this is the highest or lowest value
  isPercentage?: boolean; // True if this value should be displayed with a % symbol
}

// Calculate gradient color based on percentage value using D3 linear scale
function getGradientColor(pct: number, maxPos: number, maxNeg: number): string {
  // Define color endpoints
  const redColor = '#dc2626'; // red-600
  const grayColor = '#4b5563'; // gray-600
  const greenColor = '#16a34a'; // green-600

  // Create a linear color scale
  // Domain: [maxNeg (most negative), 0, maxPos (most positive)]
  // Range: [red, gray, green]
  const colorScale = scaleLinear<string>()
    .domain([maxNeg, 0, maxPos])
    .range([redColor, grayColor, greenColor])
    .interpolate(interpolateRgb);

  const color = colorScale(pct);

  // Return as inline style since we're using dynamic colors
  return color;
}

export function ColumnCell({
  value,
  precision = 2,
  colorCode = false,
  showSign = false,
  isEmpty = false,
  className = '',
  scaledColorPct,
  maxPositivePct,
  maxNegativePct,
  isExtreme = false,
  isPercentage = false
}: ColumnCellProps) {
  if (isEmpty || value === undefined || value === null) {
    return (
      <div className={`text-center text-gray-400 text-sm px-0.5 py-0.5 leading-tight ${className}`}>
        —
      </div>
    );
  }

  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) {
    return (
      <div className={`text-center text-gray-400 text-sm px-0.5 py-0.5 leading-tight ${className}`}>
        —
      </div>
    );
  }

  let textColorClass = 'text-gray-600';
  let textColorStyle: string | undefined = undefined;

  if (colorCode) {
    // Use gradient scaling if parameters are provided
    if (scaledColorPct !== undefined && maxPositivePct !== undefined && maxNegativePct !== undefined) {
      textColorStyle = getGradientColor(scaledColorPct, maxPositivePct, maxNegativePct);
      textColorClass = ''; // Clear the class since we're using inline style
    } else {
      // Fallback to simple binary coloring
      textColorClass = numValue >= 0 ? 'text-green-600' : 'text-red-600';
    }
  }

  const displayValue = typeof value === 'string' ? value :
    (showSign && numValue >= 0 ? '+' : '') + numValue.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }) + (isPercentage ? '%' : '');

  return (
    <div
      className={`text-right text-sm px-0.5 py-0.5 leading-tight ${isExtreme ? 'font-bold' : 'font-medium'} ${textColorClass} ${className}`}
      style={textColorStyle ? { color: textColorStyle } : undefined}
    >
      {displayValue}
    </div>
  );
}

export function RangeCell({ min, max, precision = 2 }: { min?: number; max?: number; precision?: number }) {
  if (min === undefined || max === undefined) {
    return (
      <div className="text-center text-gray-400 text-sm px-0.5 py-0.5 leading-tight">
        —
      </div>
    );
  }

  const displayValue = `${min.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })} - ${max.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`;

  return (
    <div className="text-right text-xs text-gray-700 px-0.5 py-0.5 leading-tight">
      {displayValue}
    </div>
  );
}

export function MeanRangeCell({
  mean,
  min,
  max,
  precision = 2,
  className = ''
}: {
  mean?: number;
  min?: number;
  max?: number;
  precision?: number;
  className?: string;
}) {
  if (mean === undefined || min === undefined || max === undefined) {
    return (
      <div className={`text-center text-gray-400 px-0.5 py-0.5 leading-tight ${className}`}>
        —
      </div>
    );
  }

  const meanValue = mean.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  const rangeValue = `${min.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })} - ${max.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`;

  return (
    <div className={`text-right px-0.5 py-0.5 leading-tight flex flex-col justify-center ${className}`}>
      <div className="text-sm font-medium text-gray-900">
        {meanValue}
      </div>
      <div className="text-xs text-gray-600 mt-0.5">
        {rangeValue}
      </div>
    </div>
  );
}

export function PercentAbsCell({
  percentValue,
  absValue,
  precision = 2,
  colorCode = false,
  showSign = false,
  isEmpty = false,
  scaledColorPct,
  maxPositivePct,
  maxNegativePct,
  isExtreme = false,
  className = ''
}: {
  percentValue?: number;
  absValue?: number;
  precision?: number;
  colorCode?: boolean;
  showSign?: boolean;
  isEmpty?: boolean;
  scaledColorPct?: number;
  maxPositivePct?: number;
  maxNegativePct?: number;
  isExtreme?: boolean;
  className?: string;
}) {
  if (isEmpty || percentValue === undefined || absValue === undefined) {
    return (
      <div className={`text-center text-gray-400 px-0.5 py-0.5 leading-tight ${className}`}>
        —
      </div>
    );
  }

  let textColorClass = 'text-gray-600';
  let textColorStyle: string | undefined = undefined;

  if (colorCode) {
    // Use gradient scaling if parameters are provided
    if (scaledColorPct !== undefined && maxPositivePct !== undefined && maxNegativePct !== undefined) {
      textColorStyle = getGradientColor(scaledColorPct, maxPositivePct, maxNegativePct);
      textColorClass = ''; // Clear the class since we're using inline style
    } else {
      // Fallback to simple binary coloring
      textColorClass = percentValue >= 0 ? 'text-green-600' : 'text-red-600';
    }
  }

  const displayPercent = (showSign && percentValue >= 0 ? '+' : '') + percentValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + '%';

  const displayAbs = (showSign && absValue >= 0 ? '+' : '') + absValue.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  return (
    <div className={`text-right px-0.5 py-0.5 leading-tight flex flex-col justify-center ${className}`}>
      <div
        className={`text-sm ${isExtreme ? 'font-bold' : 'font-medium'} ${textColorClass}`}
        style={textColorStyle ? { color: textColorStyle } : undefined}
      >
        {displayPercent}
      </div>
      <div
        className={`text-xs mt-0.5 ${textColorClass}`}
        style={textColorStyle ? { color: textColorStyle } : undefined}
      >
        {displayAbs}
      </div>
    </div>
  );
}
