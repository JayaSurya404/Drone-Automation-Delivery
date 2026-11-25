import { mockStore } from '../services/mockDataStore';

/**
 * Universal CSV downloader using Blob + ObjectURL
 * Works 100% reliably across all modern browsers and environments without URI length limitations.
 */
export const downloadCSV = (filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) => {
  const sanitize = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(sanitize).join(',');
  const rowLines = rows.map((row) => row.map(sanitize).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n'); // Add UTF-8 BOM for Excel compatibility

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup object URL
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
};

/**
 * Convenience helper to export array of objects to CSV
 */
export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((item) => headers.map((header) => item[header]));
  downloadCSV(filename, headers, rows);
};

/**
 * Universal PDF/Formatted Document Downloader
 * Generates a clean, professional printable HTML document that triggers browser PDF print or text file download.
 */
export const downloadFormattedReport = (title: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) => {
  const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — SKYNAV Operations Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #0f172a; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #0f172a; }
    .logo span { color: #0284c7; }
    .title { font-size: 18px; font-weight: 700; margin-top: 5px; color: #334155; }
    .meta { font-size: 11px; color: #64748b; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; padding: 10px 12px; text-align: left; }
    td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { margin: 15px; }
      th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">SKY<span>NAV</span></div>
      <div class="title">${title}</div>
    </div>
    <div class="meta">
      <div>Generated: ${dateStr} ${timeStr} IST</div>
      <div>Hub: Coimbatore Operations Command Hub</div>
      <div>Classification: Official Operations Record</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map((h) => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          ${row.map((cell) => `<td>${cell ?? '-'}</td>`).join('')}
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>SKYNAV Autonomous Aerial Logistics Platform • v3.4.0</span>
    <span>Page 1 of 1</span>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    // Fallback direct download if popup blocked
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.html`);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  }
};

/**
 * Generate Report based on Report Category
 */
export const generateReportData = (reportTitle: string) => {
  const dateStr = new Date().toISOString().split('T')[0];

  switch (reportTitle) {
    case 'Delivery Performance Audit': {
      const orders = mockStore.getOrders();
      const headers = ['Order ID', 'Customer', 'Merchant', 'Package Item', 'Weight (kg)', 'Drone ID', 'Status', 'Payment (INR)'];
      const rows = orders.map((o) => [
        o.id,
        o.customerName,
        o.merchantName,
        o.packageName,
        o.packageWeightKg,
        o.droneId || 'Unassigned',
        o.status,
        `Rs. ${o.paymentAmount}`,
      ]);
      return { filename: `skynav_delivery_performance_${dateStr}`, headers, rows };
    }

    case 'Drone Hardware Telemetry & Health': {
      const drones = mockStore.getDrones();
      const headers = ['Drone ID', 'Model', 'Serial Number', 'Status', 'Battery (%)', 'Health (%)', 'Cycles', 'Distance (km)', 'Issues'];
      const rows = drones.map((d) => [
        d.id,
        d.model,
        d.serialNumber,
        d.status,
        `${d.battery}%`,
        `${d.batteryHealth}%`,
        d.batteryCycles,
        `${d.distanceTravelledKm} km`,
        d.issuesCount,
      ]);
      return { filename: `skynav_fleet_telemetry_${dateStr}`, headers, rows };
    }

    case 'Fleet Maintenance & Repairs Log': {
      const maintenance = mockStore.getMaintenance();
      const headers = ['Record ID', 'Drone ID', 'Issue', 'Priority', 'Status', 'Scheduled Date', 'Technician', 'Notes'];
      const rows = maintenance.map((m) => [
        m.id,
        m.droneId,
        m.issue,
        m.priority,
        m.status,
        m.scheduledDate,
        m.technician || 'Pending Assignment',
        m.notes || 'Routine check',
      ]);
      return { filename: `skynav_maintenance_repairs_${dateStr}`, headers, rows };
    }

    case 'Airspace Incident & Emergency Report': {
      const emergencies = mockStore.getEmergencies();
      const headers = ['Alert ID', 'Drone ID', 'Mission ID', 'Issue Type', 'Priority', 'Battery', 'GPS Status', 'Signal', 'Timestamp', 'Status'];
      const rows = emergencies.map((e) => [
        e.id,
        e.droneId,
        e.missionId || 'N/A',
        e.issueType,
        e.priority,
        `${e.batteryLevel}%`,
        e.gpsStatus,
        e.signalStatus,
        e.timestamp,
        e.status,
      ]);
      return { filename: `skynav_airspace_incidents_${dateStr}`, headers, rows };
    }

    case 'Revenue & Financial Settlement':
    default: {
      const payments = mockStore.getPayments();
      const headers = ['Transaction ID', 'Order ID', 'Customer Name', 'Amount (INR)', 'Payment Method', 'Status', 'Timestamp'];
      const rows = payments.map((p) => [
        p.id,
        p.orderId,
        p.customerName,
        `Rs. ${p.amount}`,
        p.paymentMethod,
        p.status,
        p.timestamp,
      ]);
      return { filename: `skynav_financial_settlement_${dateStr}`, headers, rows };
    }
  }
};
