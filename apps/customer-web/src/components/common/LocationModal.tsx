import React from 'react';
import { useAddress } from '../../context/AddressContext';
import { Modal } from './Modal';
import { Button } from './Button';
import { MapPin, Check, Plus, Home, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose }) => {
  const { addresses, defaultAddress, setDefaultAddress } = useAddress();
  const navigate = useNavigate();

  const handleSelect = (addressId: string) => {
    setDefaultAddress(addressId);
    onClose();
  };

  const handleAddNew = () => {
    onClose();
    navigate('/addresses');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Delivery Location">
      <div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Select your delivery drop-off zone for instant drone availability and flight calculations.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {addresses.map((addr) => {
            const isSelected = defaultAddress?.id === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => handleSelect(addr.id)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-lg)',
                  border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border-default)',
                  background: isSelected ? 'rgba(14, 165, 233, 0.04)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(14, 165, 233, 0.12)' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {addr.label.toLowerCase().includes('office') || addr.label.toLowerCase().includes('work') ? (
                    <Building2 size={18} />
                  ) : (
                    <Home size={18} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {addr.label}
                    </span>
                    {isSelected && (
                      <span className="badge badge-cyan" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                        Active Drop Zone
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {addr.building}, {addr.street}, {addr.city} {addr.postalCode}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 700, marginTop: '0.3rem' }}>
                    🎯 Drop Type: {addr.dropZoneType || 'Backyard Lawn / Pad'}
                  </div>
                </div>

                {isSelected && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--accent-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="secondary" size="sm" onClick={handleAddNew} leftIcon={<Plus size={15} />}>
            Add New Address
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
