import React, { useState } from 'react';
import { Button } from '../common/Button';
import { PhoneCall, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';

interface InstructionsStepProps {
  initialInstructions?: string;
  onInstructionsConfirmed: (instructions: string) => void;
  onBack: () => void;
}

const PRESET_INSTRUCTIONS = [
  'Call my phone 2 minutes before landing',
  'Lower package onto marked AstroTurf target',
  'Avoid hovering near solar panels',
  'Deliver to office rooftop reception beacon',
  'Ring doorbell upon tether release',
  'Backyard pets are kept safely inside',
];

export const InstructionsStep: React.FC<InstructionsStepProps> = ({
  initialInstructions = '',
  onInstructionsConfirmed,
  onBack,
}) => {
  const [instructions, setInstructions] = useState<string>(initialInstructions);

  const handleTogglePreset = (preset: string) => {
    if (instructions.includes(preset)) {
      setInstructions((prev) =>
        prev
          .replace(preset, '')
          .replace(/,\s*,/g, ',')
          .replace(/^,\s*|,\s*$/g, '')
          .trim()
      );
    } else {
      setInstructions((prev) => (prev ? `${prev}, ${preset}` : preset));
    }
  };

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">3. Delivery & Drop-off Instructions</h3>
          <p className="section-subtitle">
            Provide any specific notes for automated flight trajectory and package release.
          </p>
        </div>
      </div>

      {/* Preset Badges */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
          Quick Delivery Preferences:
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PRESET_INSTRUCTIONS.map((preset) => {
            const isSelected = instructions.includes(preset);

            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleTogglePreset(preset)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.825rem',
                  fontWeight: 500,
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-default)',
                  background: isSelected ? 'rgba(0, 229, 255, 0.12)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {isSelected ? '✓ ' : '+ '}
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Textarea */}
      <div className="form-group" style={{ marginBottom: '2rem' }}>
        <label className="form-label">Custom Delivery Instructions (Optional)</label>
        <textarea
          rows={4}
          className="form-control"
          placeholder="e.g. Place package between the two planters on the south side of patio..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          style={{ resize: 'vertical' }}
        />
        <span className="form-hint">
          Our autonomous flight planner parses these notes to optimize terminal descent and safety buffers.
        </span>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" onClick={onBack}>
          &larr; Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={() => onInstructionsConfirmed(instructions)}
        >
          Continue to Delivery Speed &rarr;
        </Button>
      </div>
    </div>
  );
};
