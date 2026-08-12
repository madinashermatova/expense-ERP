import React, { TextareaHTMLAttributes, forwardRef } from 'react';
import styles from './Textarea.module.css';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, required, ...props }, ref) => {
    const textareaClassName = `${styles.textarea} ${error ? styles.errorTextarea : ''} ${className}`.trim();

    return (
      <div className={styles.wrapper}>
        {label && (
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <textarea ref={ref} className={textareaClassName} required={required} {...props} />
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

Textarea.displayName = 'Textarea';
