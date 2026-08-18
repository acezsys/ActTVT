import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseISO } from 'date-fns';
import { DATE_DISPLAY_FORMAT, toApiDate } from '../lib/dateFormat';

// Standard date input for the whole system: always a datepicker, always dd-MMM-yyyy.
// value/onChange work with plain 'yyyy-MM-dd' strings so it drops straight into any form state.
export default function DateField({ label, value, onChange, required }) {
  const dateValue = value ? (typeof value === 'string' ? parseISO(value) : value) : null;

  return (
    <label className="field">
      {label && <span className="field-label">{label}{required && ' *'}</span>}
      <DatePicker
        selected={dateValue}
        onChange={(date) => onChange(toApiDate(date))}
        dateFormat={DATE_DISPLAY_FORMAT.replace('yyyy', 'yyyy').replace('MMM', 'MMM').replace('dd', 'dd')}
        placeholderText="dd-Mon-yyyy"
        className="text-input"
        required={required}
        isClearable
      />
    </label>
  );
}
