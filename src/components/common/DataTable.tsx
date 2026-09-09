import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadCSV } from '../../utils/exportUtils';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchField?: (row: T) => string;
  onRowClick?: (row: T) => void;
  title?: string;
  actions?: React.ReactNode;
  exportFilename?: string;
  filterOptions?: {
    label: string;
    value: string;
    filterFn: (row: T) => boolean;
  }[];
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  searchField,
  onRowClick,
  title,
  actions,
  exportFilename = 'skynav_export.csv',
  filterOptions,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortIndex, setSortIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Filter & Search
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (activeFilter !== 'all' && filterOptions) {
        const option = filterOptions.find((f) => f.value === activeFilter);
        if (option && !option.filterFn(row)) return false;
      }
      if (searchTerm.trim() && searchField) {
        const targetStr = searchField(row).toLowerCase();
        if (!targetStr.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, activeFilter, searchTerm, searchField, filterOptions]);

  // Sorting
  const sortedData = useMemo(() => {
    if (sortIndex === null) return filteredData;
    const col = columns[sortIndex];
    return [...filteredData].sort((a, b) => {
      let valA: any = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
      let valB: any = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];
      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortIndex, sortDirection, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage]);

  const handleSort = (idx: number) => {
    if (!columns[idx].sortable) return;
    if (sortIndex === idx) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortIndex(idx);
      setSortDirection('asc');
    }
  };

  const handleExportCSV = () => {
    if (!data.length) return;
    const headers = columns.map((c) => c.header);
    const rows = sortedData.map((row) =>
      columns.map((c) => {
        if (typeof c.accessor !== 'function' && (row as any)[c.accessor] !== undefined) {
          return String((row as any)[c.accessor]);
        }
        // If accessor is a function, try to extract value
        try {
          const res = typeof c.accessor === 'function' ? c.accessor(row) : (row as any)[c.accessor];
          if (typeof res === 'string' || typeof res === 'number') {
            return String(res);
          }
          // If it returned a React element, check row for a matching field
          const possibleKey = c.header.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const k of Object.keys(row)) {
            if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === possibleKey) {
              return String((row as any)[k]);
            }
          }
          if ((row as any).name) return String((row as any).name);
          if ((row as any).id) return String((row as any).id);
          return '';
        } catch {
          return '';
        }
      })
    );

    const filename = exportFilename || `${(title || 'skynav_data').toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    downloadCSV(filename, headers, rows);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-md overflow-hidden">
      {/* Header controls */}
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/80">
        {title && <h2 className="text-lg font-bold text-slate-100 tracking-wide">{title}</h2>}

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Filter Dropdown */}
          {filterOptions && (
            <div className="relative flex items-center">
              <Filter className="absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <select
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 pl-8 pr-6 text-xs font-medium text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">All Filters</option>
                {filterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-1.5 px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            Export CSV
          </button>

          {actions}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => handleSort(idx)}
                  className={`py-3.5 px-4 font-semibold select-none ${col.sortable ? 'cursor-pointer hover:text-cyan-300' : ''} ${
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div className={`inline-flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                    {col.header}
                    {col.sortable && sortIndex === idx && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-cyan-400" /> : <ChevronDown className="h-3.5 w-3.5 text-cyan-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400">
                  No records match your criteria.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={String(row.id || rowIdx)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`group transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-800/60' : 'hover:bg-slate-800/30'}`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`py-3 px-4 text-slate-300 ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {typeof col.accessor === 'function' ? col.accessor(row) : (row[col.accessor] as any)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 text-xs text-slate-400 bg-slate-950/40">
        <div>
          Showing <span className="font-semibold text-slate-200">{Math.min(sortedData.length, (currentPage - 1) * rowsPerPage + 1)}</span> to{' '}
          <span className="font-semibold text-slate-200">{Math.min(sortedData.length, currentPage * rowsPerPage)}</span> of{' '}
          <span className="font-semibold text-slate-200">{sortedData.length}</span> entries
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded p-1 border border-slate-800 bg-slate-800/80 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-300">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded p-1 border border-slate-800 bg-slate-800/80 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
