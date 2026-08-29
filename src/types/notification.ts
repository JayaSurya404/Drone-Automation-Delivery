export type NotificationCategory = 
  | 'order' 
  | 'drone' 
  | 'security' 
  | 'system' 
  | 'promo';

export interface CustomerNotification {
  id: string;
  customerId: string;
  orderId?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}
