import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSupport } from '../../context/SupportContext';
import { useOrders } from '../../context/OrderContext';
import { useNotifications } from '../../context/NotificationContext';
import { SupportTicketCategory, SupportTicket } from '../../types/support';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageSquare,
  Paperclip,
  Clock,
  CheckCircle2,
  PhoneCall,
  Mail,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

const CATEGORIES: SupportTicketCategory[] = [
  'Delivery delayed',
  'Drone location not updating',
  'Unable to receive delivery',
  'Wrong delivery location',
  'Missing order',
  'Damaged item',
  'Payment issue',
  'General inquiry',
];

export const SupportPage: React.FC = () => {
  const location = useLocation();
  const prefillOrderId = (location.state as any)?.prefillOrderId || '';

  const { faqs, tickets, createTicket } = useSupport();
  const { orders } = useOrders();
  const { showToast } = useNotifications();

  // Accordion state
  const [openFaq, setOpenFaq] = useState<string | null>('faq_1');

  // Ticket Form State
  const [isModalOpen, setIsModalOpen] = useState(!!prefillOrderId);
  const [orderId, setOrderId] = useState<string>(prefillOrderId);
  const [category, setCategory] = useState<SupportTicketCategory>('Delivery delayed');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Ticket Viewer
  const [viewingTicket, setViewingTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState<string>('');

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setIsSubmitting(true);

    try {
      const ticket = await createTicket({
        orderId: orderId || undefined,
        category,
        subject: subject || `${category} on ${orderId || 'general inquiry'}`,
        description,
        attachmentName: attachmentName || undefined,
      });

      showToast('Support Ticket Dispatched', `Ticket #${ticket.id} created. A flight specialist will respond shortly.`, 'success');
      setIsModalOpen(false);
      setDescription('');
      setSubject('');
      setAttachmentName('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <Badge variant="cyan">Open</Badge>;
      case 'In Progress':
        return <Badge variant="indigo">In Progress</Badge>;
      case 'Resolved':
        return <Badge variant="success">Resolved</Badge>;
      default:
        return <Badge variant="warning">Closed</Badge>;
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Customer Support & Help Center</h1>
          <p className="section-subtitle">
            Get instant assistance for active flight missions, drop zone clearance, and order support.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus size={18} />}
        >
          Create Support Ticket
        </Button>
      </div>

      {/* Quick Contact Banners */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 229, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
            <PhoneCall size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Live Flight Hotline</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>1-800-SKY-DRONE</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>24/7 Operations Desk</div>
          </div>
        </div>

        <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-indigo)' }}>
            <Mail size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Email Help Desk</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>support@skylink.io</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Typical reply in &lt; 15 mins</div>
          </div>
        </div>

        <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Air Corridor Safety</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>FAA Part 135 Compliant</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Autonomous Airspace Shield</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2.5rem' }}>
        {/* Left Column: FAQs Accordion */}
        <div>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '1.25rem' }}>Frequently Asked Questions</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {faqs.map((faq) => {
              const isOpen = openFaq === faq.id;

              return (
                <div
                  key={faq.id}
                  className="card glass-panel"
                  style={{ padding: '1.25rem', cursor: 'pointer' }}
                  onClick={() => toggleFaq(faq.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isOpen ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                      {faq.question}
                    </div>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Customer Support Tickets */}
        <div>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '1.25rem' }}>My Support Inquiries ({tickets.length})</h2>

          {tickets.length === 0 ? (
            <div className="card glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No open tickets. Need help? Create a ticket anytime.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="card glass-panel-interactive"
                  onClick={() => setViewingTicket(t)}
                  style={{ padding: '1.25rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>
                      #{t.id}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {t.subject}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', gap: '1rem' }}>
                    <span>Category: {t.category}</span>
                    {t.orderId && <span>Order: #{t.orderId}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Customer Support Ticket"
        maxWidth="580px"
      >
        <form onSubmit={handleCreateTicket}>
          {/* Order Selection */}
          <div className="form-group">
            <label className="form-label">Related Order (Optional):</label>
            <select
              className="form-control"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">-- General / Non-Order Inquiry --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  Order #{o.id} ({o.status} - ₹{o.total.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Problem Category */}
          <div className="form-group">
            <label className="form-label">Problem Category:</label>
            <select
              className="form-control"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <Input
            label="Subject"
            placeholder="e.g. Delayed arrival / Landing coordinates inquiry"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Detailed Description of Issue</label>
            <textarea
              rows={4}
              className="form-control"
              placeholder="Provide specific information regarding your delivery or drop-off spot..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Optional Attachment Mock */}
          <Input
            label="Attach Landing Zone Photo / File Name (Optional)"
            placeholder="e.g. backyard_landing_pad.jpg"
            value={attachmentName}
            onChange={(e) => setAttachmentName(e.target.value)}
            leftIcon={<Paperclip size={16} />}
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ticket Viewer Modal */}
      <Modal
        isOpen={!!viewingTicket}
        onClose={() => setViewingTicket(null)}
        title={viewingTicket ? `Ticket #${viewingTicket.id}: ${viewingTicket.subject}` : 'Ticket'}
        maxWidth="600px"
      >
        {viewingTicket && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Category: </span>
                <strong>{viewingTicket.category}</strong>
                {viewingTicket.orderId && (
                  <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                    Order #{viewingTicket.orderId}
                  </span>
                )}
              </div>
              {getStatusBadge(viewingTicket.status)}
            </div>

            {/* Messages Thread */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {viewingTicket.messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: m.sender === 'customer' ? 'var(--bg-tertiary)' : 'rgba(0, 229, 255, 0.08)',
                    borderLeft: m.sender === 'customer' ? 'none' : '3px solid var(--accent-cyan)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                    <strong style={{ color: m.sender === 'customer' ? 'var(--text-primary)' : 'var(--accent-cyan)' }}>
                      {m.senderName}
                    </strong>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {m.message}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setViewingTicket(null)}>
                Close Ticket View
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
