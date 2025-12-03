interface ColumnCellProps {
  value?: number | string;
  precision?: number;
  colorCode?: boolean;
  showSign?: boolean;
  isEmpty?: boolean;
  className?: string;
  bgClassName?: string;
}

export function ColumnCell({ value, precision = 2, colorCode = false, showSign = false, isEmpty = false, className = '' }: ColumnCellProps) {
  if (isEmpty || value === undefined || value === null) {
    return (
      <div className={`text-center text-gray-400 text-sm px-1.5 py-0.5 leading-tight ${className}`}>
        —
      </div>
    );
  }

  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) {
    return (
      <div className={`text-center text-gray-400 text-sm px-1.5 py-0.5 leading-tight ${className}`}>
        —
      </div>
    );
  }

  let textColor = 'text-gray-900';
  if (colorCode) {
    textColor = numValue >= 0 ? 'text-green-600' : 'text-red-600';
  }

  const displayValue = typeof value === 'string' ? value :
    (showSign && numValue >= 0 ? '+' : '') + numValue.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });

  return (
    <div className={`text-right text-sm font-medium px-1.5 py-0.5 leading-tight ${textColor} ${className}`}>
      {displayValue}
    </div>
  );
}

export function RangeCell({ min, max, precision = 2 }: { min?: number; max?: number; precision?: number }) {
  if (min === undefined || max === undefined) {
    return (
      <div className="text-center text-gray-400 text-sm px-1.5 py-0.5 leading-tight">
        —
      </div>
    );
  }

  const displayValue = `${min.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })} - ${max.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`;

  return (
    <div className="text-right text-xs text-gray-700 px-1.5 py-0.5 leading-tight">
      {displayValue}
    </div>
  );
}
