import React, { useEffect, useState } from 'react';
import {
  formatLiveNumericInput,
  parseFormattedNumber,
} from '../utils/accountingEngine';

interface FormattedNumberInputProps {
  value: number;
  onChange: (newValue: number) => void;
  allowDecimals?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

/**
 * Beginner-friendly input that formats numbers 3-by-3 (سه رقم سه رقم) as the user types,
 * and supports explicit decimals (.00) when dealing with foreign currencies.
 */
export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  allowDecimals = false,
  disabled = false,
  placeholder = '0',
  ariaLabel,
  className = '',
}) => {
  const [displayText, setDisplayText] = useState<string>(() =>
    value === 0 ? '' : formatLiveNumericInput(value, allowDecimals)
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (!value) {
        setDisplayText('');
      } else if (allowDecimals) {
        setDisplayText(
          value.toLocaleString('en-US', {
            minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
            maximumFractionDigits: 2,
          })
        );
      } else {
        setDisplayText(Math.round(value).toLocaleString('en-US'));
      }
    }
  }, [value, allowDecimals, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setDisplayText('');
      onChange(0);
      return;
    }
    const formatted = formatLiveNumericInput(raw, allowDecimals);
    setDisplayText(formatted);
    onChange(parseFormattedNumber(formatted));
  };

  return (
    <input
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      dir="ltr"
      disabled={disabled}
      value={displayText}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={handleInputChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`font-mono-num text-left ${className}`}
    />
  );
};
