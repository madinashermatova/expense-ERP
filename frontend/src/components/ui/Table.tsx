import React, { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, forwardRef } from 'react';
import styles from './Table.module.css';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className = '', ...props }, ref) => (
    <div className={styles.wrapper}>
      <table ref={ref} className={`${styles.table} ${className}`.trim()} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <thead ref={ref} className={`${styles.header} ${className}`.trim()} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={className} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => (
    <tr ref={ref} className={`${styles.row} ${className}`.trim()} {...props} />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <th ref={ref} className={`${styles.head} ${className}`.trim()} {...props} />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td ref={ref} className={`${styles.cell} ${className}`.trim()} {...props} />
  )
);
TableCell.displayName = 'TableCell';
