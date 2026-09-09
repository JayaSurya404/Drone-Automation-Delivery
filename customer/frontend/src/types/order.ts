import { CartItem } from './product';
import { CustomerAddress } from './address';

export type CustomerOrderStatus = 
  | 'Order Placed'
  | 'Order Confirmed'
  | 'Preparing'
  | 'Drone Assigned'
  | 'Drone Preparing'
  | 'Drone Launched'
  | 'Out for Delivery'
  | 'Near Destination'
  | 'Arriving'
  | 'Delivered'
  | 'Delayed'
  | 'Cancelled'
  | 'Delivery Failed'
  | 'Returning';

export type PaymentMethod = 'Credit Card' | 'Debit Card' | 'UPI' | 'Wallet' | 'Net Banking';
export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded' | 'Failed';

export type DeliverySpeedOption = 'standard' | 'express' | 'scheduled';

export interface OrderStatusTimelineEntry {
  status: CustomerOrderStatus;
  timestamp: string;
  description: string;
  completed: boolean;
}

export interface CustomerOrder {
  id: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: CustomerOrderStatus;
  deliverySpeed: DeliverySpeedOption;
  scheduledTime?: string;
  deliveryAddress: CustomerAddress;
  deliveryInstructions?: string;
  dropZoneType?: string;
  deliveryOtp: string; // Handover OTP code
  isCancellable: boolean;
  estimatedDeliveryTime: string; // e.g. "12 mins" or "11:45 AM"
  estimatedArrivalTimestamp?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  timeline: OrderStatusTimelineEntry[];
  rating?: {
    stars: number;
    feedback?: string;
    submittedAt: string;
  };
  cancellationReason?: string;
}
