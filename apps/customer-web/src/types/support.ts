export type SupportTicketCategory = 
  | 'Delivery delayed'
  | 'Drone location not updating'
  | 'Unable to receive delivery'
  | 'Wrong delivery location'
  | 'Missing order'
  | 'Damaged item'
  | 'Payment issue'
  | 'General inquiry';

export type SupportTicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface SupportTicketMessage {
  id: string;
  sender: 'customer' | 'support';
  senderName: string;
  message: string;
  timestamp: string;
  attachmentUrl?: string;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  orderId?: string;
  category: SupportTicketCategory;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
  attachmentName?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'Drone Delivery' | 'Orders & Tracking' | 'Payments & Refunds' | 'Safety & Drop-off';
}
