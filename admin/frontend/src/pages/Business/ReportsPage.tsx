import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { FileSpreadsheet, Download, FileText, CheckCircle2, Printer, Sparkles } from 'lucide-react';
import { generateReportData, downloadCSV, downloadFormattedReport } from '../../utils/exportUtils';

export const ReportsPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedReport, setSelectedReport] = useState('Delivery Performance Audit');

  const reportTypes = [
    {
      title: 'Delivery Performance Audit',
      desc: 'Detailed log of delivery times, cancellations, SLA compliance, merchant fulfillment rates, and revenue.',
      badge: 'Operational SLA',
    },
    {
      title: 'Drone Hardware Telemetry & Health',
      desc: 'ESC motor vibrations, battery health degradation, temperature limits, flight hours, and cycle counts.',
      badge: 'Hardware Telemetry',
    },
    {
      title: 'Fleet Maintenance & Repairs Log',
      desc: 'Overdue service records, technician labor, component replacements, and scheduled safety audits.',
      badge: 'Regulatory Compliance',
    },
    {
      title: 'Airspace Incident & Emergency Report',
      desc: 'Critical battery drops, GPS signal loss, forced landings, fail-safes, and route deviation logs.',
      badge: 'DGCA Airspace Safety',
    },
    {
      title: 'Revenue & Financial Settlement',
      desc: 'Merchant payouts, delivery fees collected, Razorpay settlements, and processed refund summaries.',
      badge: 'Financial Auditing',
    },
  ];

  const handleExport = (reportTitle: string, format: 'CSV' | 'PDF') => {
    try {
      const data = generateReportData(reportTitle);

      if (format === 'CSV') {
        downloadCSV(data.filename, data.headers, data.rows);
        addToast(
          'success',
          `Exporting ${reportTitle}`,
          `Generated CSV spreadsheet (${data.rows.length} records) downloaded successfully.`
        );
      } else {
        downloadFormattedReport(reportTitle, data.headers, data.rows);
        addToast(
          'success',
          `Generating ${reportTitle}`,
          `Formatted report opened in document viewer with print/PDF layout.`
        );
      }
    } catch (err) {
      addToast('error', 'Export Failed', 'An error occurred while generating the export file.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <FileSpreadsheet className="w-3.5 h-3.5" /> COMPLIANCE & AUDITING ENGINE
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Operational Reports Generator
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generate and export compliance reports for DGCA regulations, commercial business auditing, and fleet maintenance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport(selectedReport, 'CSV')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 px-4 py-2 text-xs font-black shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            <Download className="w-4 h-4" /> Export Selected ({selectedReport.split(' ')[0]})
          </button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((rep) => {
          const isSelected = selectedReport === rep.title;
          return (
            <div
              key={rep.title}
              onClick={() => setSelectedReport(rep.title)}
              className={`rounded-3xl border p-5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-xl shadow-cyan-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase font-mono mb-2">
                    {rep.badge}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-500" /> {rep.title}
                  </h3>
                </div>
                {isSelected && (
                  <span className="p-1 rounded-full bg-cyan-500 text-slate-950">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{rep.desc}</p>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-800/80 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(rep.title, 'CSV');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-2 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-slate-700 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-cyan-500" /> Export CSV Spreadsheet
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(rep.title, 'PDF');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-2 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5 text-emerald-500" /> Printable Report / PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
