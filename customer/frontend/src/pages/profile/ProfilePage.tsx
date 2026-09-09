import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { api } from '../../services/api';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  Calendar,
  Bell,
  Trash2,
  CheckCircle2,
  Camera,
  AlertTriangle,
} from 'lucide-react';

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
];

export const ProfilePage: React.FC = () => {
  const { user, updateProfile, resetPassword, logout } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    avatar: user?.avatar || AVATAR_OPTIONS[0],
    emailUpdates: user?.notificationPreferences?.emailUpdates ?? true,
    smsAlerts: user?.notificationPreferences?.smsAlerts ?? true,
    droneProximitySound: user?.notificationPreferences?.droneProximitySound ?? true,
  });

  // Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);

  // Delete Account Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        avatar: formData.avatar,
        notificationPreferences: {
          emailUpdates: formData.emailUpdates,
          smsAlerts: formData.smsAlerts,
          droneProximitySound: formData.droneProximitySound,
        },
      });

      showToast('Profile Updated', 'Your customer information was saved.', 'success');
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    if (newPass.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('Passwords do not match.');
      return;
    }

    try {
      await api.customer.changePassword(currentPass, newPass, confirmPass);
      showToast('Password Changed', 'Your account password has been updated.', 'success');
      setIsPasswordModalOpen(false);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassError(err.message || 'Password change failed.');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm account deletion.');
      return;
    }
    await logout();
    navigate('/login');
  };

  return (
    <div className="main-content" style={{ maxWidth: '840px' }}>
      {/* Header */}
      <div className="section-header">
        <h1>Customer Account Settings</h1>
        <p className="section-subtitle">
          Manage your verified customer profile, flight notification preferences, and security.
        </p>
      </div>

      {/* Main Profile Info Card */}
      <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={formData.avatar}
                alt={user?.name || 'Customer'}
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent-cyan)',
                  boxShadow: '0 0 20px var(--accent-cyan-glow)',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{user?.name}</h2>
                {user?.isVerified && (
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    <ShieldCheck size={13} />
                    <span>Verified Customer</span>
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{user?.email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                <Calendar size={13} />
                <span>Customer Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {!isEditing ? (
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          )}
        </div>

        {/* Profile Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSaveProfile}>
            {/* Avatar Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                Choose Profile Avatar:
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {AVATAR_OPTIONS.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Avatar ${idx + 1}`}
                    onClick={() => setFormData({ ...formData, avatar: url })}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      border: formData.avatar === url ? '3px solid var(--accent-cyan)' : '2px solid transparent',
                      boxShadow: formData.avatar === url ? '0 0 12px var(--accent-cyan-glow)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                leftIcon={<User size={18} />}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                leftIcon={<Mail size={18} />}
                required
              />
              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                leftIcon={<Phone size={18} />}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button variant="ghost" type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Phone Number</span>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>{user?.phone}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Account Security</span>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#10b981', marginTop: '0.2rem' }}>2-Factor Protected</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Default Drop Zone</span>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>Backyard Lawn Pad</div>
            </div>
          </div>
        )}
      </div>

      {/* Flight Notifications Preferences */}
      <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={18} color="var(--accent-cyan)" />
          <span>Flight Alert & Notification Preferences</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>SMS Flight Alerts</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Receive text messages when drone launches and approaches landing zone.</div>
            </div>
            <input
              type="checkbox"
              checked={formData.smsAlerts}
              onChange={(e) => {
                setFormData({ ...formData, smsAlerts: e.target.checked });
                updateProfile({ notificationPreferences: { ...user?.notificationPreferences, smsAlerts: e.target.checked } as any });
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Email Invoices & Order Confirmations</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Receive digital VAT invoices and order milestone emails.</div>
            </div>
            <input
              type="checkbox"
              checked={formData.emailUpdates}
              onChange={(e) => {
                setFormData({ ...formData, emailUpdates: e.target.checked });
                updateProfile({ notificationPreferences: { ...user?.notificationPreferences, emailUpdates: e.target.checked } as any });
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Drone Proximity Audio Ping</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Play gentle chime when the drone arrives within 100 meters.</div>
            </div>
            <input
              type="checkbox"
              checked={formData.droneProximitySound}
              onChange={(e) => {
                setFormData({ ...formData, droneProximitySound: e.target.checked });
                updateProfile({ notificationPreferences: { ...user?.notificationPreferences, droneProximitySound: e.target.checked } as any });
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }}
            />
          </label>
        </div>
      </div>

      {/* Security & Password Settings */}
      <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} color="var(--accent-cyan)" />
          <span>Security & Authentication</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Update your customer password or manage security credentials.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setIsPasswordModalOpen(true)}>
            Change Password
          </Button>
        </div>
      </div>

      {/* Danger Zone: Delete Account */}
      <div className="card glass-panel" style={{ padding: '2rem', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.04)' }}>
        <h3 style={{ fontSize: '1.15rem', color: '#ef4444', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>Customer Danger Zone</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Deleting your customer account will remove all saved landing pins, flight histories, and payment tokens.
        </p>

        <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)} leftIcon={<Trash2 size={14} />}>
          Delete Customer Account
        </Button>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Password"
      >
        <form onSubmit={handleChangePassword}>
          {passError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {passError}
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            required
          />

          <Input
            label="New Password"
            type="password"
            placeholder="Min. 8 characters"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Confirm new password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            required
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Customer Account"
      >
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            This action is permanent and cannot be undone. To confirm, please type <strong>DELETE</strong> below:
          </p>

          <Input
            placeholder="Type DELETE to confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmText !== 'DELETE'}
              onClick={handleDeleteAccount}
            >
              Permanently Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
