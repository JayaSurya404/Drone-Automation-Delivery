import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAddresses } from '../../context/AddressContext';
import { useNotifications } from '../../context/NotificationContext';
import { CustomerAddress, GeofenceCheckResult } from '../../types/address';
import { ClearanceRadiusOption, OverheadHazardChecklist } from '../../types/airspace';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { GeofenceChecker } from '../../components/map/GeofenceChecker';
import { ClearanceRadiusSelector } from '../../components/map/ClearanceRadiusSelector';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import {
  MapPin,
  Home,
  Building2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Crosshair,
  TreePine,
  Building,
  Car,
  Shield,
  Disc,
} from 'lucide-react';

export const AddressesPage: React.FC = () => {
  const { user } = useAuth();
  const { addresses, saveAddress, deleteAddress, setDefaultAddress } = useAddresses();
  const { showToast } = useNotifications();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [airspaceResult, setAirspaceResult] = useState<GeofenceCheckResult | null>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    label: 'Home' as 'Home' | 'Office' | 'Other',
    building: '',
    street: '',
    area: '',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641048',
    latitude: 11.1132,
    longitude: 77.0277,
    dropZoneType: 'Lawn' as 'Lawn' | 'Rooftop Pad' | 'Balcony Landing' | 'Driveway',
    clearanceRadius: 3.5 as ClearanceRadiusOption,
    hazardsChecklist: {
      noWires: true,
      levelGround: true,
      clearSkyView: true,
      petsProtected: true,
    } as OverheadHazardChecklist,
    instructions: '',
    isDefault: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setAirspaceResult(null);
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      label: 'Home',
      building: '',
      street: '',
      area: '',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641048',
      latitude: 11.1132,
      longitude: 77.0277,
      dropZoneType: 'Lawn',
      clearanceRadius: 3.5,
      hazardsChecklist: {
        noWires: true,
        levelGround: true,
        clearSkyView: true,
        petsProtected: true,
      },
      instructions: '',
      isDefault: addresses.length === 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setAirspaceResult(null);
    setFormData({
      name: addr.name,
      phone: addr.phone,
      label: addr.label,
      building: addr.building,
      street: addr.street,
      area: addr.area || '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      latitude: addr.latitude,
      longitude: addr.longitude,
      dropZoneType: (addr.dropZoneType as any) || 'Lawn',
      clearanceRadius: ((addr.clearanceRadiusMeters as any) || 3.5) as ClearanceRadiusOption,
      hazardsChecklist: {
        noWires: true,
        levelGround: true,
        clearSkyView: true,
        petsProtected: true,
      },
      instructions: addr.instructions || '',
      isDefault: addr.isDefault,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this delivery address?')) {
      await deleteAddress(id);
      showToast('Address Deleted', 'Delivery address removed.', 'info');
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultAddress(id);
    showToast('Default Address Set', 'Default landing address updated.', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (airspaceResult && !airspaceResult.isEligible) {
      alert(`Aviation Safety Violation: Cannot save address. ${airspaceResult.message}`);
      return;
    }

    setIsSaving(true);

    try {
      await saveAddress({
        ...(editingAddress ? { id: editingAddress.id } : {}),
        ...formData,
        clearanceRadiusMeters: formData.clearanceRadius,
        hazardsVerified: Object.values(formData.hazardsChecklist).every(Boolean),
      });

      showToast('Address Saved', editingAddress ? 'Address updated.' : 'New landing location added.', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Saved Delivery Addresses</h1>
          <p className="section-subtitle">
            Manage your rooftop beacons, lawn landing pads, and verified GPS drone coordinates with FAA airspace clearance.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenAdd}
          leftIcon={<Plus size={18} />}
        >
          Add Delivery Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin size={36} />}
          title="No Saved Addresses"
          description="Add a delivery address to make checkout faster and save exact drone landing pads."
          actionText="Add First Address"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="address-grid">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="card glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.5rem',
                border: addr.isDefault ? '2px solid var(--accent-cyan)' : '1px solid var(--border-default)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }}>
                    {addr.label === 'Home' ? (
                      <Home size={18} color="var(--accent-cyan)" />
                    ) : addr.label === 'Office' ? (
                      <Building2 size={18} color="var(--accent-indigo)" />
                    ) : (
                      <MapPin size={18} color="#10b981" />
                    )}
                    <span>{addr.label}</span>
                  </div>

                  {addr.isDefault && (
                    <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
                      Default Drop-off
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {addr.name}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {addr.building}, {addr.street}
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)' }}>
                  {addr.city}, {addr.state} {addr.postalCode}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                  📞 {addr.phone}
                </div>

                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.825rem' }}>
                  <div style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Crosshair size={14} />
                      <span>Drop Zone: {addr.dropZoneType || 'Lawn'}</span>
                    </span>

                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(14, 165, 233, 0.1)',
                        color: 'var(--accent-blue, #0284c7)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      🎯 {addr.clearanceRadiusMeters || 3.5}m Clearance
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                    GPS: {addr.latitude?.toFixed(4)}° N, {Math.abs(addr.longitude || 0)?.toFixed(4)}° W
                  </div>
                  {addr.instructions && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      <em>"{addr.instructions}"</em>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                {!addr.isDefault ? (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}
                  >
                    Set as Default
                  </button>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Active Default</span>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleOpenEdit(addr)}
                    style={{ padding: '0.35rem', color: 'var(--text-secondary)' }}
                    title="Edit address"
                    aria-label="Edit address"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    style={{ padding: '0.35rem', color: 'var(--danger)' }}
                    title="Delete address"
                    aria-label="Delete address"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddress ? 'Edit Delivery Address & Drop Zone' : 'Add New Drone Landing Spot'}
        maxWidth="680px"
      >
        <form onSubmit={handleSubmit}>
          {/* Label selector */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {(['Home', 'Office', 'Other'] as const).map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setFormData({ ...formData, label: lbl })}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: formData.label === lbl ? '2px solid var(--accent-cyan)' : '1px solid var(--border-default)',
                  background: formData.label === lbl ? 'rgba(0, 229, 255, 0.08)' : 'var(--bg-card)',
                  color: formData.label === lbl ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <Input
              label="Recipient Full Name"
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
              label="House / Apt / Unit"
              placeholder="e.g. Apt 4B"
              value={formData.building}
              onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              required
            />
            <Input
              label="Street Name"
              placeholder="e.g. 742 Evergreen Terrace"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <Input
              label="Area / District"
              placeholder="e.g. Sunset"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            />
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input
              label="Postal Code"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              required
            />
          </div>

          {/* Airspace Safety Check */}
          <div style={{ margin: '1rem 0 0.5rem 0' }}>
            <GeofenceChecker
              latitude={formData.latitude}
              longitude={formData.longitude}
              clearanceRadiusMeters={formData.clearanceRadius}
              onEligibilityChecked={(res) => setAirspaceResult(res)}
            />
          </div>

          {/* Interactive GPS Pin Dropper with NFZ Overlays */}
          <div style={{ margin: '0.75rem 0 1rem 0' }}>
            <LocationPickerMap
              initialLat={formData.latitude}
              initialLng={formData.longitude}
              clearanceRadius={formData.clearanceRadius}
              isEligible={airspaceResult ? airspaceResult.isEligible : true}
              onLocationChange={(newLat, newLng) => setFormData({ ...formData, latitude: newLat, longitude: newLng })}
              height="280px"
            />
          </div>

          {/* Precision Clearance Radius Selector & Hazard Checklist */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ClearanceRadiusSelector
              selectedRadius={formData.clearanceRadius}
              onRadiusChange={(radius) => setFormData({ ...formData, clearanceRadius: radius })}
              checklist={formData.hazardsChecklist}
              onChecklistChange={(list) => setFormData({ ...formData, hazardsChecklist: list })}
            />
          </div>

          {/* Landing Terrain */}
          <div className="form-group">
            <label className="form-label">Drop Zone Terrain:</label>
            <select
              className="form-control"
              value={formData.dropZoneType}
              onChange={(e) => setFormData({ ...formData, dropZoneType: e.target.value as any })}
            >
              <option value="Lawn">Backyard / Lawn (Grass)</option>
              <option value="Rooftop Pad">Flat Rooftop Landing Beacon</option>
              <option value="Driveway">Private Driveway (Paved)</option>
              <option value="Balcony Landing">Spacious Balcony</option>
            </select>
          </div>

          {/* Drop Instructions */}
          <Input
            label="Specific Flight / Drop Instructions (Optional)"
            placeholder="e.g. Lower package onto AstroTurf pad in backyard..."
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
          />

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span>Set as my default drone delivery address</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSaving}
              disabled={airspaceResult !== null && !airspaceResult.isEligible}
            >
              {airspaceResult && !airspaceResult.isEligible ? 'Airspace Prohibited' : 'Save Address'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
