export type CustomerOrderStatus =
  | 'Pending Dispatch'
  | 'Order Confirmed'
  | 'Preparing'
  | 'Order Packed'
  | 'Drone Assigned'
  | 'Drone Launched'
  | 'Out for Delivery'
  | 'Near Destination'
  | 'Arriving'
  | 'Delivered'
  | 'Cancelled'
  | 'Delivery Failed'
  | 'Delayed';

export type AdminOrderStatus =
  | 'pending'
  | 'accepted'
  | 'packing'
  | 'packed'
  | 'ready_for_dispatch'
  | 'drone_assigned'
  | 'in_flight'
  | 'arriving'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type DroneStatus =
  | 'available'
  | 'assigned'
  | 'in_flight'
  | 'returning'
  | 'charging'
  | 'maintenance'
  | 'offline'
  | 'emergency';

export type MissionStatus =
  | 'created'
  | 'assigned'
  | 'in_flight'
  | 'approaching'
  | 'delivered'
  | 'returning'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'emergency';

export interface LocationCoordinates {
  lat: number;
  lng: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface SharedProduct {
  id: string;
  name: string;
  slug?: string;
  brand?: string;
  categoryId: string;
  categoryName?: string;
  subCategory?: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  stockCount: number;
  weightGrams: number;
  isDroneEligible: boolean;
  maxPayloadKg?: number;
  estimatedDeliveryMins?: number;
  image: string;
  badge?: string;
  inStock?: boolean;
}

export function mapAdminStatusToCustomer(status: AdminOrderStatus): CustomerOrderStatus {
  switch (status) {
    case 'pending':
      return 'Pending Dispatch';
    case 'accepted':
    case 'packing':
      return 'Preparing';
    case 'packed':
      return 'Order Packed';
    case 'ready_for_dispatch':
      return 'Preparing';
    case 'drone_assigned':
      return 'Drone Assigned';
    case 'in_flight':
      return 'Out for Delivery';
    case 'arriving':
      return 'Arriving';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Delivery Failed';
    default:
      return 'Pending Dispatch';
  }
}
