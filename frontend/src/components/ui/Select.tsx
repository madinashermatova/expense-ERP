import React, { SelectHTMLAttributes, forwardRef } from 'react';
import styles from './Select.module.css';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, required, children, ...props }, ref) => {
    const selectClassName = `${styles.select} ${error ? styles.errorSelect : ''} ${className}`.trim();

    return (
      <div className={styles.wrapper}>
        {label && (
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          <select ref={ref} className={selectClassName} required={required} {...props}>
            {children}
          </select>
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <ChevronDown size={16} color="rgb(var(--muted-foreground))" />
          </div>
        </div>
        {error && (
          <span className={styles.errorText}>
            <AlertCircle size={14} />
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
