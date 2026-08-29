import React, { useState } from 'react';
import { CustomerAddress } from '../../types/address';
import { useAddresses } from '../../context/AddressContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Plus, Home, Building2, MapPin, CheckCircle2 } from 'lucide-react';

interface AddressStepProps {
  selectedAddress: CustomerAddress | null;
  onSelectAddress: (address: CustomerAddress) => void;
  onNext: () => void;
}

export const AddressStep: React.FC<AddressStepProps> = ({
  selectedAddress,
  onSelectAddress,
  onNext,
}) => {
  const { addresses, saveAddress } = useAddresses();
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: 'Alex Mercer',
    phone: '+1 (555) 248-7790',
    label: 'Home' as const,
    building: '',
    street: '',
    area: '',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94107',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.building.trim()) newErrors.building = 'Building/House number is required.';
    if (!formData.street.trim()) newErrors.street = 'Street name is required.';
    if (!formData.city.trim()) newErrors.city = 'City is required.';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Postal code is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const saved = await saveAddress({
      ...formData,
      latitude: 37.7749,
      longitude: -122.4194,
      isDefault: false,
      dropZoneType: 'Lawn',
    });

    onSelectAddress(saved);
    setIsAddingNew(false);
  };

  const getLabelIcon = (label: string) => {
    if (label === 'Home') return <Home size={16} color="var(--accent-cyan)" />;
    if (label === 'Office') return <Building2 size={16} color="var(--accent-indigo)" />;
    return <MapPin size={16} color="#10b981" />;
  };

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">1. Select Delivery Address</h3>
          <p className="section-subtitle">Choose where your drone shipment will be directed</p>
        </div>

        {!isAddingNew && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setIsAddingNew(true)}
          >
            Add New Address
          </Button>
        )}
      </div>

      {isAddingNew ? (
        <form onSubmit={handleCreateAddress} className="card glass-panel" style={{ marginTop: '1rem', padding: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Enter New Address</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <Input
              label="Recipient Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <Input
              label="House / Apt / Suite"
              placeholder="e.g. Apt 4B"
              value={formData.building}
              onChange={(e) => {
                setFormData({ ...formData, building: e.target.value });
                if (errors.building) setErrors({ ...errors, building: '' });
              }}
              error={errors.building}
              required
            />
            <Input
              label="Street Address"
              placeholder="e.g. 742 Evergreen Terrace"
              value={formData.street}
              onChange={(e) => {
                setFormData({ ...formData, street: e.target.value });
                if (errors.street) setErrors({ ...errors, street: '' });
              }}
              error={errors.street}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <Input
              label="Area / Neighborhood"
              placeholder="e.g. Sunset District"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            />
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              error={errors.city}
              required
            />
            <Input
              label="Postal Code"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              error={errors.postalCode}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsAddingNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save & Use Address
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="address-grid" style={{ marginTop: '1rem' }}>
            {addresses.map((addr) => {
              const isSelected = selectedAddress?.id === addr.id;

              return (
                <div
                  key={addr.id}
                  className={`address-selectable-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectAddress(addr)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
                      {getLabelIcon(addr.label)}
                      <span>{addr.label}</span>
                      {addr.isDefault && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', background: 'rgba(0, 229, 255, 0.1)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)' }}>
                          Default
                        </span>
                      )}
                    </div>

                    {isSelected && <CheckCircle2 size={18} color="var(--accent-cyan)" />}
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {addr.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {addr.building}, {addr.street}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                    {addr.city}, {addr.state} {addr.postalCode}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    📞 {addr.phone}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button
              variant="primary"
              size="lg"
              disabled={!selectedAddress}
              onClick={onNext}
            >
              Continue to Drop-off Pin &rarr;
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
