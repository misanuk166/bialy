import { useState, useEffect, useRef } from 'react';
import type { DateRange } from './RangeControls';

interface DateRangeSliderProps {
  dateRange: DateRange;
  dataExtent?: [Date, Date];
  onChange: (range: DateRange) => void;
  readOnly?: boolean;
}

export function DateRangeSlider({ dateRange, dataExtent, onChange, readOnly = false }: DateRangeSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartPercents, setDragStartPercents] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // Generate array of dates for slider precision
  const dates = dataExtent ? (() => {
    const arr: Date[] = [];
    const start = new Date(dataExtent[0]);
    const end = new Date(dataExtent[1]);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      arr.push(new Date(d));
    }

    return arr;
  })() : [];

  // Calculate current slider values (0-100%)
  const getSliderValues = (): { startPercent: number; endPercent: number; startDate: Date; endDate: Date } => {
    if (!dataExtent || dates.length === 0) {
      const now = new Date();
      return { startPercent: 0, endPercent: 100, startDate: now, endDate: now };
    }

    let startDate: Date;
    let endDate: Date;

    if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    } else {
      // For presets or 'all', use full data extent
      startDate = dataExtent[0];
      endDate = dataExtent[1];
    }

    // Find closest date indices
    let startIdx = dates.findIndex(d => d >= startDate);
    if (startIdx === -1) startIdx = 0;

    let endIdx = dates.findIndex(d => d >= endDate);
    if (endIdx === -1) endIdx = dates.length - 1;

    const startPercent = (startIdx / Math.max(1, dates.length - 1)) * 100;
    const endPercent = (endIdx / Math.max(1, dates.length - 1)) * 100;

    return {
      startPercent,
      endPercent,
      startDate: dates[startIdx] || dataExtent[0],
      endDate: dates[endIdx] || dataExtent[1]
    };
  };

  const sliderValues = getSliderValues();
  const { startPercent, endPercent, startDate, endDate } = sliderValues;

  // Early return if no valid dates
  if (!startDate || !endDate) {
    return (
      <div className="w-full px-4 py-2 text-xs text-gray-500 text-center">
        Loading date range...
      </div>
    );
  }

  const handleMouseDown = (handle: 'start' | 'end', e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setIsDragging(handle);
  };

  const handleRangeMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setIsDragging('range');
    setDragStartX(e.clientX);
    setDragStartPercents({ start: startPercent, end: endPercent });
  };

  useEffect(() => {
    if (!isDragging || !sliderRef.current || readOnly) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = sliderRef.current!.getBoundingClientRect();

      if (isDragging === 'range') {
        // Dragging the entire range - move both start and end together
        const deltaX = e.clientX - dragStartX;
        const deltaPercent = (deltaX / rect.width) * 100;

        let newStartPercent = dragStartPercents.start + deltaPercent;
        let newEndPercent = dragStartPercents.end + deltaPercent;

        // Clamp to bounds
        const rangeWidth = newEndPercent - newStartPercent;
        if (newStartPercent < 0) {
          newStartPercent = 0;
          newEndPercent = rangeWidth;
        }
        if (newEndPercent > 100) {
          newEndPercent = 100;
          newStartPercent = 100 - rangeWidth;
        }

        // Convert to dates
        const newStartIdx = Math.round((newStartPercent / 100) * (dates.length - 1));
        const newEndIdx = Math.round((newEndPercent / 100) * (dates.length - 1));
        const newStartDate = dates[newStartIdx];
        const newEndDate = dates[newEndIdx];

        if (newStartDate && newEndDate) {
          onChange({
            preset: 'custom',
            startDate: newStartDate,
            endDate: newEndDate
          });
        }
      } else {
        // Dragging individual handles
        let percent = ((e.clientX - rect.left) / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));

        // Convert percent to date index
        const dateIdx = Math.round((percent / 100) * (dates.length - 1));
        const newDate = dates[dateIdx];

        if (!newDate) return;

        // Update the appropriate date
        if (isDragging === 'start') {
          // Ensure start doesn't go past end
          if (newDate < endDate) {
            onChange({
              preset: 'custom',
              startDate: newDate,
              endDate: endDate
            });
          }
        } else if (isDragging === 'end') {
          // Ensure end doesn't go before start
          if (newDate > startDate) {
            onChange({
              preset: 'custom',
              startDate: startDate,
              endDate: newDate
            });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dates, startDate, endDate, readOnly, dragStartX, dragStartPercents]);

  // Format date for display (full)
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format date as MM-YY
  const formatDateShort = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${month} ${year}`;
  };

  // Check if labels would overlap (within 10% of slider width)
  const labelsOverlap = Math.abs(endPercent - startPercent) < 10;

  // Generate tick marks (show monthly ticks)
  const tickMarks = dates.filter((date, idx) => {
    if (idx === 0 || idx === dates.length - 1) return true;
    return date.getDate() === 1; // First day of month
  });

  return (
    <div className="w-full px-4 py-1.5">
      {/* Slider */}
      <div
        ref={sliderRef}
        className="relative h-6 w-full"
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
      >
        {/* Track - ultra thin */}
        <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-[3px] bg-gray-100 rounded-full" />

        {/* Selected range - simple blue */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 h-[3px] bg-blue-500 rounded-full transition-all cursor-grab active:cursor-grabbing"
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
            cursor: readOnly ? 'default' : isDragging === 'range' ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleRangeMouseDown}
        />

        {/* MM-YY labels for start and end */}
        {labelsOverlap ? (
          // If overlapping, show only the range as one label
          <div
            className="absolute bottom-[-10px] text-[9px] text-gray-600 transform -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${(startPercent + endPercent) / 2}%` }}
          >
            {formatDateShort(startDate)} - {formatDateShort(endDate)}
          </div>
        ) : (
          // If not overlapping, show separate labels
          <>
            <div
              className="absolute bottom-[-10px] text-[9px] text-gray-600 transform -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${startPercent}%` }}
            >
              {formatDateShort(startDate)}
            </div>
            <div
              className="absolute bottom-[-10px] text-[9px] text-gray-600 transform -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${endPercent}%` }}
            >
              {formatDateShort(endDate)}
            </div>
          </>
        )}

        {/* Start handle - small solid blue */}
        {!readOnly && (
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-grab hover:scale-125 transition-transform z-10"
            style={{
              left: `${startPercent}%`,
              cursor: isDragging === 'start' ? 'grabbing' : 'grab',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}
            onMouseDown={(e) => handleMouseDown('start', e)}
          >
            {/* Date label on hover */}
            <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow-md text-[10px] font-medium text-gray-700 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
              {formatDate(startDate)}
            </div>
          </div>
        )}

        {/* End handle - small solid blue */}
        {!readOnly && (
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-grab hover:scale-125 transition-transform z-10"
            style={{
              left: `${endPercent}%`,
              cursor: isDragging === 'end' ? 'grabbing' : 'grab',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}
            onMouseDown={(e) => handleMouseDown('end', e)}
          >
            {/* Date label on hover */}
            <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow-md text-[10px] font-medium text-gray-700 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
              {formatDate(endDate)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
