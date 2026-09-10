import React, { useState } from 'react';
import { CustomerAddress } from '../../types/address';
import { useAuth } from '../../context/AuthContext';
import { useAddresses } from '../../context/AddressContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Plus, Home, Building2, MapPin, CheckCircle2, Navigation, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

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
  const { user } = useAuth();
  const { addresses, saveAddress } = useAddresses();
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceStatus, setServiceStatus] = useState<{
    message: string;
    isEligible: boolean;
    distanceKm: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    label: 'Home' as const,
    building: '',
    street: '',
    area: '',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641062',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Haversine distance in km
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  };

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser. Please enter your address manually.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));

        // Authoritative Hub: SkyHub Chinniyampalayam (11.0550, 77.0650)
        const hubLat = 11.0550;
        const hubLng = 77.0650;
        const distKm = calculateDistanceKm(hubLat, hubLng, lat, lng);
        const eligible = distKm <= 12.0;

        let detectedStreet = 'Avinashi Road';
        let detectedArea = 'Chinniyampalayam';
        let detectedCity = 'Coimbatore';
        let detectedState = 'Tamil Nadu';
        let detectedPostcode = '641062';

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'SkyNav-Drone-Delivery/3.4' },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.address) {
              const a = data.address;
              detectedStreet = a.road || a.suburb || detectedStreet;
              detectedArea = a.neighbourhood || a.suburb || detectedArea;
              detectedCity = a.city || a.town || a.county || 'Coimbatore';
              detectedState = a.state || 'Tamil Nadu';
              detectedPostcode = a.postcode || '641062';
            }
          }
        } catch {
          // Fallback gracefully
        }

        setFormData((prev) => ({
          ...prev,
          building: prev.building || 'Detected Drop Zone',
          street: detectedStreet,
          area: detectedArea,
          city: detectedCity,
          state: detectedState,
          postalCode: detectedPostcode,
        }));

        setDetectedCoords({ lat, lng });

        setServiceStatus({
          message: eligible
            ? `Delivery available (${distKm} km from SkyHub Chinniyampalayam)`
            : `Outside 12 km service radius from SkyHub Chinniyampalayam (${distKm} km away)`,
          isEligible: eligible,
          distanceKm: distKm,
        });

        setIsAddingNew(true);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation permission error or unavailable:', err);
        setIsLocating(false);
        alert('Could not access device location. Please enter your address details manually.');
        setIsAddingNew(true);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

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

    const finalLat = detectedCoords?.lat || 11.0550;
    const finalLng = detectedCoords?.lng || 77.0650;

    const saved = await saveAddress({
      ...formData,
      latitude: finalLat,
      longitude: finalLng,
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
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 className="card-title">1. Select Delivery Address</h3>
          <p className="section-subtitle">Choose where your drone shipment will be directed in Coimbatore</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={isLocating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            onClick={handleUseMyLocation}
            disabled={isLocating}
          >
            {isLocating ? 'Detecting Location…' : 'My Location'}
          </Button>

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
      </div>

      {/* Service radius indicator alert if location was detected */}
      {serviceStatus && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${serviceStatus.isEligible ? '#10b981' : '#f87171'}`,
            background: serviceStatus.isEligible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
            color: serviceStatus.isEligible ? '#059669' : '#dc2626',
            fontWeight: 600,
          }}
        >
          {serviceStatus.isEligible ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
          <span>{serviceStatus.message}</span>
        </div>
      )}

      {isAddingNew ? (
        <form onSubmit={handleCreateAddress} className="card glass-panel" style={{ marginTop: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>Enter Delivery Address</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              SkyHub Chinniyampalayam 12 km delivery zone
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <Input
              label="Recipient Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              placeholder="+91 98422 00000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginTop: '1rem' }}>
            <Input
              label="House / Flat / Villa"
              placeholder="e.g. 42, Royal Residency"
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
              placeholder="e.g. Avinashi Road"
              value={formData.street}
              onChange={(e) => {
                setFormData({ ...formData, street: e.target.value });
                if (errors.street) setErrors({ ...errors, street: '' });
              }}
              error={errors.street}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <Input
              label="Area / Locality"
              placeholder="e.g. Chinniyampalayam / Peelamedu"
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

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
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
export default AddressStep;
