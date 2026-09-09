import React from 'react';
import { ClearanceRadiusOption, OverheadHazardChecklist } from '../../types/airspace';
import { Disc, ShieldCheck, AlertCircle, Check, Info } from 'lucide-react';

interface ClearanceRadiusSelectorProps {
  selectedRadius: ClearanceRadiusOption;
  onRadiusChange: (radius: ClearanceRadiusOption) => void;
  checklist?: OverheadHazardChecklist;
  onChecklistChange?: (checklist: OverheadHazardChecklist) => void;
  showChecklist?: boolean;
}

const RADIUS_OPTIONS: {
  radius: ClearanceRadiusOption;
  label: string;
  badge: string;
  description: string;
  flightMode: string;
  recommendedFor: string;
}[] = [
  {
    radius: 2.0,
    label: '2.0m Precision',
    badge: 'Tether Drop',
    description: 'Autonomous winch lowers package while drone hovers 10m overhead.',
    flightMode: 'High-Altitude Winch Deployment',
    recommendedFor: 'Townhouse lawns, balconies, tight patio spaces',
  },
  {
    radius: 3.5,
    label: '3.5m Standard',
    badge: 'Recommended',
    description: 'Standard hexacopter landing clearance corridor with sonar guidance.',
    flightMode: 'Direct Precision Touchdown',
    recommendedFor: 'Suburban backyards, driveways, garden lawns',
  },
  {
    radius: 5.0,
    label: '5.0m Heavy-Lift',
    badge: 'Max Margin',
    description: 'Wide gust-buffer perimeter for multi-rotor heavy cargo pods.',
    flightMode: 'Full-Perimeter VTOL Descent',
    recommendedFor: 'Rooftop pads, large estates, parking aprons',
  },
];

export const ClearanceRadiusSelector: React.FC<ClearanceRadiusSelectorProps> = ({
  selectedRadius,
  onRadiusChange,
  checklist = { noWires: true, levelGround: true, clearSkyView: true, petsProtected: true },
  onChecklistChange,
  showChecklist = true,
}) => {
  const handleToggleChecklist = (key: keyof OverheadHazardChecklist) => {
    if (onChecklistChange) {
      onChecklistChange({
        ...checklist,
        [key]: !checklist[key],
      });
    }
  };

  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const confidenceScore = Math.round((checkedCount / 4) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Radius Options */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Disc size={16} color="var(--accent-cyan, #0ea5e9)" />
            <span>Designated Drop-Zone Clearance Radius:</span>
          </label>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Radius: <strong>{selectedRadius.toFixed(1)} meters</strong>
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          {RADIUS_OPTIONS.map((opt) => {
            const isSelected = selectedRadius === opt.radius;
            return (
              <div
                key={opt.radius}
                onClick={() => onRadiusChange(opt.radius)}
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--accent-cyan, #0ea5e9)' : '1.5px solid var(--border-default, #e2e8f0)',
                  background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-card, #ffffff)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-tertiary, #f1f5f9)',
                      color: isSelected ? 'var(--accent-blue, #0284c7)' : 'var(--text-secondary, #64748b)',
                    }}
                  >
                    {opt.badge}
                  </span>
                  {isSelected && <Check size={16} color="var(--accent-blue, #0284c7)" />}
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {opt.label}
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.35 }}>
                  {opt.description}
                </p>

                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.4rem', borderTop: '1px dashed var(--border-subtle, #e2e8f0)', paddingTop: '0.35rem' }}>
                  Ideal for: <em>{opt.recommendedFor}</em>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overhead Clearance Self-Checklist */}
      {showChecklist && onChecklistChange && (
        <div
          style={{
            padding: '1rem',
            background: 'var(--bg-tertiary, #f8fafc)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem' }}>
              <ShieldCheck size={17} color="#10b981" />
              <span>Overhead Landing Safety Audit</span>
            </div>

            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: confidenceScore === 100 ? '#059669' : '#d97706',
              }}
            >
              Clearance Confidence: {confidenceScore}%
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
            {[
              { key: 'noWires' as const, label: 'No overhead powerlines or tree branches' },
              { key: 'clearSkyView' as const, label: 'Clear vertical line-of-sight to the open sky' },
              { key: 'levelGround' as const, label: 'Flat level terrain (< 10° surface slope)' },
              { key: 'petsProtected' as const, label: 'Pets and children safely clear of drop zone' },
            ].map((item) => (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: checklist[item.key] ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checklist[item.key]}
                  onChange={() => handleToggleChecklist(item.key)}
                  style={{ accentColor: '#0ea5e9' }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          {confidenceScore < 100 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: '#fffbeb',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>
                Please ensure all safety requirements are met. Autonomous delivery requires unobstructed airspace for vertical descent.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
