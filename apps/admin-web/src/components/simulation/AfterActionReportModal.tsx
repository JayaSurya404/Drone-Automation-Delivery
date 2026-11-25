import React from 'react';
import { Modal } from '../common/Modal';
import { Award, Download, CheckCircle2, ShieldCheck, FileSpreadsheet, FileText, Battery, Gauge, Wind, AlertTriangle, Printer } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import { useToast } from '../../context/ToastContext';

interface AfterActionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId?: string;
  droneId?: string;
}

export const AfterActionReportModal: React.FC<AfterActionReportModalProps> = ({
  isOpen,
  onClose,
  missionId = 'MIS-20491',
  droneId = 'D-024',
}) => {
  const { addToast } = useToast();

  if (!isOpen) return null;

  const reportData = {
    missionId,
    droneId,
    droneModel: 'SKYNAV X1 (Commercial VTOL)',
    clientName: 'KMCH Cardiology Emergency Center',
    destination: 'RS Puram Sector 4 Pad',
    orderId: 'ORD-10482',
    payloadWeightKg: 2.8,
    flightDurationMin: 4.53,
    distanceKm: 7.0,
    startBatteryPct: 95,
    endBatteryPct: 66,
    batteryConsumedPct: 29,
    weatherConditions: '24°C, Wind 18 km/h NE Gusts, VFR Clear',
    obstaclesDetected: 1,
    obstacleType: 'Construction Crane Mast @ 180m',
    autonomousReroutes: 1,
    rerouteVector: 'Lateral West (+120m Clearance)',
    decisionLatencyMs: 38,
    safetyIncidents: 0,
    deliveryAccuracyM: 0.03,
    overallScore: 96,
    scoresBreakdown: [
      { category: 'Route Corridor Efficiency', score: 94, max: 100, comment: 'Optimal lateral avoidance bypass' },
      { category: 'Battery Power Conservation', score: 96, max: 100, comment: '4.14% drain per km (Above average)' },
      { category: 'DGCA Airspace Safety & Deconfliction', score: 100, max: 100, comment: 'Zero geofence or altitude violations' },
      { category: 'Precision Touchdown Accuracy', score: 98, max: 100, comment: '0.03m optical pad lock' },
      { category: 'Autonomous Decision Performance', score: 95, max: 100, comment: '38ms inference & execution speed' },
      { category: 'Weather Wind Shear Handling', score: 93, max: 100, comment: 'Active 3.2° crab angle stabilization' },
    ],
  };

  const handleExportCSV = () => {
    exportToCSV(
      reportData.scoresBreakdown.map((s) => ({
        Mission_ID: reportData.missionId,
        Drone_ID: reportData.droneId,
        Category: s.category,
        Score: s.score,
        Max_Score: s.max,
        Assessment: s.comment,
        Total_Distance_KM: reportData.distanceKm,
        Duration_Minutes: reportData.flightDurationMin,
        Battery_Consumed_Pct: reportData.batteryConsumedPct,
        Overall_Score: reportData.overallScore,
      })),
      `SKYNAV_AAR_${missionId}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    addToast('success', 'After-Action Report Exported', 'CSV summary saved to downloads.');
  };

  const handleExportPDF = () => {
    window.print();
    addToast('info', 'Printing PDF Document', 'System print dialogue launched for formal AAR PDF.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Autonomous Mission After-Action Report (AAR) — ${missionId}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-200">
        {/* Top Header Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-950 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Award className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-emerald-400">{missionId}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px] uppercase">
                  ✓ MISSION VERIFIED 100% SUCCESSFUL
                </span>
              </div>
              <p className="text-xs text-slate-300 font-sans mt-0.5">
                Asset: <b className="text-white">{droneId}</b> • Order: <b className="text-white">{reportData.orderId}</b> • Handover: <b className="text-white">{reportData.destination}</b>
              </p>
            </div>
          </div>

          <div className="text-right font-mono shrink-0">
            <span className="text-3xl font-black text-emerald-400">{reportData.overallScore}</span>
            <span className="text-slate-400 text-sm font-bold"> / 100</span>
            <span className="text-[10px] text-slate-400 block">COMPOSITE SAFETY SCORE</span>
          </div>
        </div>

        {/* Operational Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 font-mono text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">TOTAL DISTANCE</span>
            <span className="font-black text-sm text-slate-900 dark:text-slate-100">{reportData.distanceKm} km</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">FLIGHT DURATION</span>
            <span className="font-black text-sm text-cyan-600 dark:text-cyan-400">{reportData.flightDurationMin} min</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">BATTERY USED</span>
            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{reportData.batteryConsumedPct}%</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">OBSTACLE REROUTES</span>
            <span className="font-black text-sm text-amber-500">{reportData.autonomousReroutes} Avoided</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">DECISION SPEED</span>
            <span className="font-black text-sm text-blue-500">{reportData.decisionLatencyMs} ms</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">DROP ACCURACY</span>
            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{reportData.deliveryAccuracyM} m Lock</span>
          </div>
        </div>

        {/* Detailed Category Assessment Table */}
        <div className="space-y-2">
          <h4 className="font-black text-xs uppercase tracking-wider font-mono text-slate-900 dark:text-slate-100">
            SAFETY & OPERATIONAL CATEGORY BREAKDOWN
          </h4>

          <div className="space-y-2">
            {reportData.scoresBreakdown.map((item) => (
              <div
                key={item.category}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-900 dark:text-slate-100">{item.category}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{item.score} / {item.max}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">{item.comment}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Export Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-mono text-slate-400">DGCA Form 14-A Electronic Ledger Verified</span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:text-cyan-500 transition-colors text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:text-cyan-500 transition-colors text-xs"
            >
              <Printer className="w-4 h-4 text-cyan-500" /> Print / PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs"
            >
              Close Report
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
