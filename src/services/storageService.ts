import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import type { Series } from '../types/series';

const STORAGE_BUCKET = 'csv-files';

/**
 * Upload a CSV file to Supabase Storage
 * Returns the file path in storage
 */
export async function uploadCSVFile(file: File, userId: string): Promise<string> {
  try {
    // Generate unique file path: {userId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
    const filePath = `${userId}/${timestamp}-${fileName}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    return data.path;
  } catch (error) {
    console.error('Failed to upload CSV file:', error);
    throw error;
  }
}

/**
 * Download and parse a CSV file from Supabase Storage
 * Returns the parsed Series object
 */
export async function downloadCSVFile(filePath: string): Promise<Series> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(filePath);

    if (error) {
      console.error('Error downloading file:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from storage');
    }

    // Convert blob to text
    const text = await data.text();

    // Parse CSV
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const series = parseCSVToSeries(results.data, filePath);
            resolve(series);
          } catch (err) {
            reject(err);
          }
        },
        error: (error: Error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    });
  } catch (error) {
    console.error('Failed to download CSV file:', error);
    throw error;
  }
}

/**
 * Delete a CSV file from Supabase Storage
 */
export async function deleteCSVFile(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete CSV file:', error);
    throw error;
  }
}

/**
 * Save a Series object as a CSV file in Supabase Storage
 * Used for synthetic metrics or programmatically generated data
 * Returns the file path in storage
 */
export async function saveSeriesAsCSV(series: Series, userId: string): Promise<string> {
  try {
    // Convert series data to CSV format
    const csvData = series.data.map(point => ({
      date: point.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      numerator: point.numerator,
      denominator: point.denominator
    }));

    // Generate CSV string using PapaParse
    const csv = Papa.unparse(csvData, {
      columns: ['date', 'numerator', 'denominator'],
      header: true
    });

    // Create a Blob from the CSV string
    const blob = new Blob([csv], { type: 'text/csv' });

    // Generate unique file path
    const timestamp = Date.now();
    const safeName = series.metadata.name.replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName = `${safeName}-${timestamp}.csv`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'text/csv'
      });

    if (error) {
      console.error('Error saving series as CSV:', error);
      throw error;
    }

    return data.path;
  } catch (error) {
    console.error('Failed to save series as CSV:', error);
    throw error;
  }
}

/**
 * Get public URL for a CSV file (for debugging)
 */
export function getPublicURL(filePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Parse CSV data to Series object
 * Expected CSV format: date, numerator, denominator columns
 */
function parseCSVToSeries(data: any[], filePath: string): Series {
  if (!data || data.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Get column names from first row
  const columns = Object.keys(data[0]);

  if (columns.length < 2) {
    throw new Error('CSV must have at least 2 columns (date and values)');
  }

  // Try to identify columns
  const dateColumn = columns.find(col =>
    /date|time|timestamp/i.test(col)
  ) || columns[0];

  const numeratorColumn = columns.find(col =>
    /numerator|value|amount|count|total/i.test(col) && col !== dateColumn
  ) || columns[1];

  const denominatorColumn = columns.find(col =>
    /denominator/i.test(col)
  ) || columns[2];

  // Extract name from filename
  const fileName = filePath.split('/').pop()?.replace(/\.csv$/, '') || 'Metric';
  const name = fileName.replace(/-|_/g, ' ').trim();

  // Extract labels
  const numeratorLabel = numeratorColumn?.replace(/_/g, ' ') || 'value';
  const denominatorLabel = denominatorColumn?.replace(/_/g, ' ') || '1';

  // Parse data points
  const dataPoints: Array<{ date: Date; numerator: number; denominator: number }> = [];

  for (const row of data) {
    const dateStr = row[dateColumn];
    const numerator = parseFloat(row[numeratorColumn]);
    const denominator = denominatorColumn ? parseFloat(row[denominatorColumn]) : 1;

    if (!dateStr || isNaN(numerator)) {
      continue; // Skip invalid rows
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      continue; // Skip invalid dates
    }

    dataPoints.push({
      date,
      numerator,
      denominator: isNaN(denominator) ? 1 : denominator
    });
  }

  if (dataPoints.length === 0) {
    throw new Error('No valid data points found in CSV');
  }

  // Sort by date
  dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    id: crypto.randomUUID(),
    data: dataPoints,
    metadata: {
      name,
      description: `Imported from ${fileName}`,
      uploadDate: new Date(),
      numeratorLabel,
      denominatorLabel
    }
  };
}

