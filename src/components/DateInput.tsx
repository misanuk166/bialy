import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DateInputProps {
  selected: Date | null | undefined;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  placeholderText?: string;
}

/**
 * Tailwind-styled wrapper for react-datepicker
 * Handles dates in local time without timezone issues
 */
export function DateInput({ selected, onChange, minDate, maxDate, className = '', placeholderText }: DateInputProps) {
  return (
    <DatePicker
      selected={selected || null}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      dateFormat="yyyy-MM-dd"
      placeholderText={placeholderText}
      className={`w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      wrapperClassName="w-full"
      popperClassName="react-datepicker-popper"
      calendarClassName="react-datepicker-calendar"
    />
  );
}
