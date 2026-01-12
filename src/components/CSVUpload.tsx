import React, { useState, useRef } from 'react';
import { parseCSVToTimeSeries, createSeries } from '../utils/csvParser';
import { uploadCSVFile } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import type { Series, CSVValidationResult } from '../types/series';

interface CSVUploadProps {
  onSeriesLoaded: (series: Series, filePath?: string) => void;
}

export function CSVUpload({ onSeriesLoaded }: CSVUploadProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [validation, setValidation] = useState<CSVValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setValidation(null);
    setUploadProgress('');

    try {
      // Step 1: Parse and validate CSV
      setUploadProgress('Parsing CSV...');
      const text = await file.text();
      const { data, validation: result } = await parseCSVToTimeSeries(text);

      setValidation(result);

      if (result.valid && data.length > 0) {
        // Step 2: Create series object
        const series = createSeries(data, {
          name: file.name.replace('.csv', ''),
          numeratorLabel: 'value',
          denominatorLabel: '1'
        });

        // Step 3: Upload file to Supabase Storage (if user is authenticated)
        let filePath: string | undefined;
        if (user) {
          try {
            setUploadProgress('Uploading to storage...');
            const uploadResult = await uploadCSVFile(file, user.id);
            filePath = uploadResult.path;
            setUploadProgress('Upload complete!');
          } catch (uploadError) {
            console.error('[CSV UPLOAD] Upload failed:', uploadError);
            console.warn('Failed to upload file to storage, continuing without storage:', uploadError);
            // Continue without storage - file will work locally
          }
        } else {
          console.warn('[CSV UPLOAD] No user logged in, skipping upload');
        }

        // Step 4: Return series and file path
        onSeriesLoaded(series, filePath);
      }
    } catch (error) {
      setValidation({
        valid: false,
        errors: [{
          type: 'column_count',
          message: error instanceof Error ? error.message : 'Failed to parse CSV file'
        }]
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setUploadProgress(''), 2000); // Clear progress message after 2s
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      handleFile(file);
    } else {
      setValidation({
        valid: false,
        errors: [{
          type: 'column_count',
          message: 'Please upload a CSV file'
        }]
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const downloadSampleCSV = () => {
    window.open('/sample-data.csv', '_blank');
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="text-4xl">📊</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Upload Time Series Data
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Drop a CSV file here or click to browse
            </p>
          </div>

          {isProcessing && (
            <div className="text-blue-600 font-medium">
              {uploadProgress || 'Processing...'}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p className="font-medium">Required CSV format:</p>
        <pre className="bg-gray-100 p-3 rounded mt-2 text-xs overflow-x-auto">
{`date,numerator,denominator
2024-01-01,5000,1
2024-01-02,5200,1`}
        </pre>
        <button
          onClick={downloadSampleCSV}
          className="mt-2 text-blue-600 hover:text-blue-800 underline text-xs"
        >
          Download sample CSV
        </button>
      </div>

      {validation && !validation.valid && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-900 mb-2">Validation Errors:</h4>
          <ul className="space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index} className="text-sm text-red-800">
                • {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation && validation.valid && validation.warnings && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">Warnings:</h4>
          <ul className="space-y-1">
            {validation.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-yellow-800">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation && validation.valid && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✓ CSV loaded successfully!
          </p>
        </div>
      )}
    </div>
  );
}
