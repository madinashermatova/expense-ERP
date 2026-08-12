import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helpText, required, ...props }, ref) => {
    const inputClassName = `${styles.input} ${error ? styles.errorInput : ''} ${className}`.trim();

    return (
      <div className={styles.inputWrapper}>
        {label && (
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <input ref={ref} className={inputClassName} required={required} {...props} />
        {error && (
          <span className={styles.errorText}>
            <AlertCircle size={14} />
            {error}
          </span>
        )}
        {helpText && !error && <span className={styles.helpText}>{helpText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
