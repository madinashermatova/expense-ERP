import { HTMLAttributes, forwardRef } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'destructive' | 'info';
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'neutral', ...props }, ref) => (
    <div ref={ref} className={`${styles.badge} ${styles[variant]} ${className}`.trim()} {...props} />
  )
);
Badge.displayName = 'Badge';
