import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/index.js";

export function Table({ className = "", children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shadow-sm">
      <table className={`w-full text-left text-xs text-slate-800 dark:text-slate-200 border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-slate-100/90 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = "", children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-slate-200/80 dark:divide-slate-800/60 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = "", children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ className = "", children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`py-3.5 px-4 font-semibold ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className = "", children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`py-3.5 px-4 text-slate-800 dark:text-slate-200 ${className}`} {...props}>
      {children}
    </td>
  );
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = ""
}: PaginationProps) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 px-2 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
      <div>
        {totalItems !== undefined && (
          <span>
            Showing <strong className="text-slate-900 dark:text-slate-200">{Math.min(totalItems, (currentPage - 1) * (pageSize || 10) + 1)}</strong> to{" "}
            <strong className="text-slate-900 dark:text-slate-200">{Math.min(totalItems, currentPage * (pageSize || 10))}</strong> of{" "}
            <strong className="text-slate-900 dark:text-slate-200">{totalItems}</strong> entries
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={16} />
        </button>

        <span className="px-3 py-1 text-slate-800 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
