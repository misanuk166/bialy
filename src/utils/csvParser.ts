import Papa from 'papaparse';
import { parseISO, isValid } from 'date-fns';
import type {
  CSVRow,
  MultiMetricCSVRow,
  CSVFormat,
  CSVValidationResult,
  CSVValidationError,
  TimeSeriesPoint,
  Series,
  SeriesMetadata
} from '../types/series';

/**
 * Validates CSV data structure and content
 */
export function validateCSV(rows: CSVRow[]): CSVValidationResult {
  const errors: CSVValidationError[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    errors.push({
      type: 'column_count',
      message: 'CSV file is empty'
    });
    return { valid: false, errors, warnings };
  }

  // Check if first row has the required headers
  const firstRow = rows[0];
  if (!('date' in firstRow) || !('numerator' in firstRow) || !('denominator' in firstRow)) {
    errors.push({
      type: 'header',
      message: 'CSV must contain exactly 3 columns: date, numerator, denominator'
    });
    return { valid: false, errors, warnings };
  }

  // Track duplicate dates
  const seenDates = new Set<string>();

  // Validate each row
  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because index is 0-based and we skip header

    // Validate date
    const dateStr = row.date?.trim();
    if (!dateStr) {
      errors.push({
        type: 'date_format',
        message: `Missing date in row ${rowNumber}`,
        row: rowNumber
      });
    } else {
      const parsedDate = parseISO(dateStr);
      if (!isValid(parsedDate)) {
        errors.push({
          type: 'date_format',
          message: `Invalid date format in row ${rowNumber}. Expected format: YYYY-MM-DD`,
          row: rowNumber
        });
      } else if (seenDates.has(dateStr)) {
        warnings.push(`Duplicate date found: ${dateStr}. Only the last value will be used.`);
      } else {
        seenDates.add(dateStr);
      }
    }

    // Validate numerator
    const numerator = parseFloat(row.numerator);
    if (isNaN(numerator)) {
      errors.push({
        type: 'numeric',
        message: `Non-numeric value found in numerator column, row ${rowNumber}`,
        row: rowNumber
      });
    }

    // Validate denominator
    const denominator = parseFloat(row.denominator);
    if (isNaN(denominator)) {
      errors.push({
        type: 'numeric',
        message: `Non-numeric value found in denominator column, row ${rowNumber}`,
        row: rowNumber
      });
    } else if (denominator <= 0) {
      errors.push({
        type: 'denominator_invalid',
        message: `Denominator must be greater than 0 in row ${rowNumber}`,
        row: rowNumber
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Parses CSV file and converts to TimeSeriesPoint array
 */
export function parseCSVToTimeSeries(csvData: string): Promise<{
  data: TimeSeriesPoint[];
  validation: CSVValidationResult;
}> {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validation = validateCSV(results.data);

        if (!validation.valid) {
          resolve({ data: [], validation });
          return;
        }

        // Convert to TimeSeriesPoint array
        const dataMap = new Map<string, TimeSeriesPoint>();

        results.data.forEach((row) => {
          const dateStr = row.date?.trim();
          const date = parseISO(dateStr);
          const numerator = parseFloat(row.numerator);
          const denominator = parseFloat(row.denominator);

          // Handle duplicates by keeping the last value
          dataMap.set(dateStr, { date, numerator, denominator });
        });

        // Convert map to array and sort by date
        const data = Array.from(dataMap.values()).sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        );

        resolve({ data, validation });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}

/**
 * Creates a Series object from parsed data
 */
export function createSeries(
  data: TimeSeriesPoint[],
  metadata: Partial<SeriesMetadata> = {}
): Series {
  const defaultMetadata: SeriesMetadata = {
    name: metadata.name || 'Untitled Series',
    description: metadata.description || '',
    uploadDate: new Date(),
    numeratorLabel: metadata.numeratorLabel || 'value',
    denominatorLabel: metadata.denominatorLabel || '1'
  };

  return {
    id: crypto.randomUUID(),
    data,
    metadata: { ...defaultMetadata, ...metadata }
  };
}

/**
 * Detects CSV format (single-metric vs multi-metric)
 */
export function detectCSVFormat(headers: string[]): CSVFormat {
  const hasMetricName = headers.includes('metric_name');
  const hasDate = headers.includes('date');
  const hasNumerator = headers.includes('numerator');
  const hasDenominator = headers.includes('denominator');

  const hasBasicColumns = hasDate && hasNumerator && hasDenominator;

  if (hasMetricName && hasBasicColumns) {
    return 'multi';
  }

  if (hasBasicColumns && !hasMetricName) {
    return 'single';
  }

  throw new Error('Invalid CSV format. Must contain columns: date, numerator, denominator. For multi-metric format, also include: metric_name');
}

/**
 * Validates multi-metric CSV data
 */
export function validateMultiMetricCSV(rows: MultiMetricCSVRow[]): CSVValidationResult {
  const errors: CSVValidationError[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    errors.push({
      type: 'column_count',
      message: 'CSV file is empty'
    });
    return { valid: false, errors, warnings };
  }

  // Check required headers
  const firstRow = rows[0];
  if (!('date' in firstRow) || !('metric_name' in firstRow) ||
      !('numerator' in firstRow) || !('denominator' in firstRow)) {
    errors.push({
      type: 'header',
      message: 'Multi-metric CSV must contain columns: date, metric_name, numerator, denominator'
    });
    return { valid: false, errors, warnings };
  }

  // Track seen combinations of date + metric_name
  const seenCombinations = new Set<string>();

  // Validate each row
  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because index is 0-based and we skip header

    // Validate metric_name
    const metricName = row.metric_name?.trim();
    if (!metricName) {
      errors.push({
        type: 'header',
        message: `Missing metric_name in row ${rowNumber}`,
        row: rowNumber
      });
    }

    // Validate date
    const dateStr = row.date?.trim();
    if (!dateStr) {
      errors.push({
        type: 'date_format',
        message: `Missing date in row ${rowNumber}`,
        row: rowNumber
      });
    } else {
      const parsedDate = parseISO(dateStr);
      if (!isValid(parsedDate)) {
        errors.push({
          type: 'date_format',
          message: `Invalid date format in row ${rowNumber}. Expected format: YYYY-MM-DD`,
          row: rowNumber
        });
      } else if (metricName) {
        // Check for duplicate date + metric_name combinations
        const combo = `${dateStr}|${metricName}`;
        if (seenCombinations.has(combo)) {
          warnings.push(`Duplicate entry found for metric "${metricName}" on ${dateStr}. Only the last value will be used.`);
        } else {
          seenCombinations.add(combo);
        }
      }
    }

    // Validate numerator
    const numerator = parseFloat(row.numerator);
    if (isNaN(numerator)) {
      errors.push({
        type: 'numeric',
        message: `Non-numeric value found in numerator column, row ${rowNumber}`,
        row: rowNumber
      });
    }

    // Validate denominator
    const denominator = parseFloat(row.denominator);
    if (isNaN(denominator)) {
      errors.push({
        type: 'numeric',
        message: `Non-numeric value found in denominator column, row ${rowNumber}`,
        row: rowNumber
      });
    } else if (denominator <= 0) {
      errors.push({
        type: 'denominator_invalid',
        message: `Denominator must be greater than 0 in row ${rowNumber}`,
        row: rowNumber
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Parses multi-metric CSV file and converts to array of Series
 */
export function parseMultiMetricCSV(csvData: string): Promise<{
  series: Series[];
  validation: CSVValidationResult;
}> {
  return new Promise((resolve, reject) => {
    Papa.parse<MultiMetricCSVRow>(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validation = validateMultiMetricCSV(results.data);

        if (!validation.valid) {
          resolve({ series: [], validation });
          return;
        }

        // Group rows by metric_name
        const metricGroups = new Map<string, MultiMetricCSVRow[]>();

        results.data.forEach((row) => {
          const metricName = row.metric_name?.trim();
          if (!metricName) return;

          if (!metricGroups.has(metricName)) {
            metricGroups.set(metricName, []);
          }
          metricGroups.get(metricName)!.push(row);
        });

        // Create a Series for each metric
        const seriesArray: Series[] = [];

        metricGroups.forEach((rows, metricName) => {
          // Use a map to handle duplicates (keep last value)
          const dataMap = new Map<string, TimeSeriesPoint>();

          rows.forEach((row) => {
            const dateStr = row.date?.trim();
            const date = parseISO(dateStr);
            const numerator = parseFloat(row.numerator);
            const denominator = parseFloat(row.denominator);

            dataMap.set(dateStr, { date, numerator, denominator });
          });

          // Convert map to array and sort by date
          const data = Array.from(dataMap.values()).sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          // Create series with metric_name as the name
          const series = createSeries(data, {
            name: metricName,
            numeratorLabel: 'value',
            denominatorLabel: '1'
          });

          seriesArray.push(series);
        });

        resolve({ series: seriesArray, validation });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}
