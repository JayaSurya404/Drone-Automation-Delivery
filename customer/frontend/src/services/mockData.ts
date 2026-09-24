import { Product } from '../types/product';
import { CustomerAddress } from '../types/address';
import { CustomerOrder } from '../types/order';
import { CustomerNotification } from '../types/notification';
import { FAQItem, SupportTicket } from '../types/support';
import { CustomerUser } from '../types/auth';
import { MASTER_PRODUCTS } from '../../../../shared/contracts/catalog.ts';

export const INITIAL_USER: CustomerUser = {
  id: 'cust_984210',
  name: 'Alex Mercer',
  email: 'alex.mercer@skynav.io',
  phone: '+1 (555) 248-7790',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  isVerified: true,
  accountStatus: 'active',
  createdAt: '2026-01-15T09:30:00.000Z',
  updatedAt: '2026-08-20T14:22:00.000Z',
  notificationPreferences: {
    emailUpdates: true,
    smsAlerts: true,
    droneProximitySound: true,
  },
};

export const INITIAL_ADDRESSES: CustomerAddress[] = [
  {
    id: 'addr_1',
    customerId: 'cust_984210',
    label: 'Home',
    name: 'Customer SkyNav',
    phone: '+91 98765 43210',
    building: 'Tech Corridor Block 4',
    street: 'Kalapatti Main Road',
    area: 'Kurumbapalayam',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641048',
    latitude: 11.0725,
    longitude: 77.0345,
    instructions: 'Lower package onto marked drone landing pad in lawn. Ring bell upon drop.',
    isDefault: true,
    dropZoneType: 'Lawn',
  },
  {
    id: 'addr_2',
    customerId: 'cust_984210',
    label: 'Office',
    name: 'Customer SkyNav (Work)',
    phone: '+91 98765 43210',
    building: 'Tidel Park Coimbatore, ELCOSEZ',
    street: 'Civil Aerodrome Post',
    area: 'Peelamedu',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641014',
    latitude: 11.0280,
    longitude: 77.0260,
    instructions: 'Designated rooftop drone landing pad. Reception security will verify OTP.',
    isDefault: false,
    dropZoneType: 'Rooftop Pad',
  },
];

export const INITIAL_PRODUCTS: Product[] = MASTER_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  brand: p.brand,
  category: (['Food', 'Groceries', 'Medicine', 'Documents', 'Electronics', 'Other'].includes(p.categoryName)
    ? p.categoryName
    : (p.categoryId === 'cat_food' ? 'Food'
      : p.categoryId === 'cat_med' ? 'Medicine'
      : p.categoryId === 'cat_groc' ? 'Groceries'
      : p.categoryId === 'cat_elec' ? 'Electronics'
      : p.categoryId === 'cat_doc' ? 'Documents'
      : 'Other')) as any,
  category_id: p.categoryId,
  subCategory: p.subCategory,
  description: p.description,
  price: p.price,
  originalPrice: p.originalPrice,
  discountPercent: p.discountPercent,
  currency: p.currency || 'INR',
  rating: p.rating,
  reviewCount: p.reviewCount,
  image: p.image,
  images: p.images,
  isDroneEligible: p.isDroneEligible,
  maxPayloadKg: +(p.weightGrams / 1000).toFixed(2),
  estimatedDeliveryMins: p.deliveryMins,
  inStock: p.inStock,
  stockCount: p.stockCount,
  badge: p.badge,
  features: p.features,
  specifications: p.specs,
  dimensions: p.dimensions,
  weightGrams: p.weightGrams,
  weight: `${p.weightGrams}g`,
  tags: p.tags,
}));

export const INITIAL_ORDERS: CustomerOrder[] = [
  {
    id: 'ORD-10245',
    customerId: 'cust_984210',
    items: [
      { product: INITIAL_PRODUCTS[10], quantity: 1 }, // Apollo Rapid Emergency First-Aid Trauma Kit
      { product: INITIAL_PRODUCTS[12], quantity: 1 }, // BoAt Storm GaN 65W Rapid Dual-Port Fast Charger
    ],
    subtotal: 1798.00,
    deliveryFee: 0,
    tax: 89.90,
    discount: 100.00,
    total: 1787.90,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Paid',
    status: 'Out for Delivery',
    deliverySpeed: 'express',
    deliveryAddress: INITIAL_ADDRESSES[0],
    deliveryInstructions: 'Lower package onto the marked AstroTurf pad in backyard lawn.',
    dropZoneType: 'Lawn',
    deliveryOtp: '8492',
    isCancellable: false,
    estimatedDeliveryTime: '8 minutes',
    estimatedArrivalTimestamp: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      {
        status: 'Order Placed',
        timestamp: '11:15 AM',
        description: 'Customer order placed successfully and payment secured.',
        completed: true,
      },
      {
        status: 'Order Confirmed',
        timestamp: '11:16 AM',
        description: 'Order confirmed and inventory locked at SkyHub Central.',
        completed: true,
      },
      {
        status: 'Preparing',
        timestamp: '11:18 AM',
        description: 'Items loaded and balanced inside AeroSafe cargo compartment.',
        completed: true,
      },
      {
        status: 'Drone Assigned',
        timestamp: '11:21 AM',
        description: 'AeroSky Drone #04 assigned with verified airspace corridor.',
        completed: true,
      },
      {
        status: 'Drone Launched',
        timestamp: '11:23 AM',
        description: 'Drone departed launchpad and cruising at 65m altitude.',
        completed: true,
      },
      {
        status: 'Out for Delivery',
        timestamp: '11:25 AM',
        description: 'In-flight en route to destination landing coordinates.',
        completed: true,
      },
      {
        status: 'Near Destination',
        timestamp: 'Expected 11:31 AM',
        description: 'Drone enters terminal descent zone over customer coordinates.',
        completed: false,
      },
      {
        status: 'Arriving',
        timestamp: 'Expected 11:32 AM',
        description: 'Precision sonar alignment over landing pad.',
        completed: false,
      },
      {
        status: 'Delivered',
        timestamp: 'Expected 11:33 AM',
        description: 'Package safely released and customer OTP verified.',
        completed: false,
      },
    ],
  },
  {
    id: 'ORD-10190',
    customerId: 'cust_984210',
    items: [
      { product: INITIAL_PRODUCTS[0], quantity: 1 }, // Kovai Crispy Masala Dosa & Sambar Breakfast Box
      { product: INITIAL_PRODUCTS[8], quantity: 1 }, // Coimbatore Authentic Filter Coffee Blend
    ],
    subtotal: 520.00,
    deliveryFee: 49.00,
    tax: 26.00,
    discount: 50.00,
    total: 545.00,
    paymentMethod: 'UPI',
    paymentStatus: 'Paid',
    status: 'Delivered',
    deliverySpeed: 'standard',
    deliveryAddress: INITIAL_ADDRESSES[0],
    deliveryInstructions: 'Backyard lawn drop-off pad.',
    dropZoneType: 'Lawn',
    deliveryOtp: '4190',
    isCancellable: false,
    estimatedDeliveryTime: 'Delivered',
    createdAt: '2026-08-27T18:30:00.000Z',
    updatedAt: '2026-08-27T18:48:00.000Z',
    completedAt: '2026-08-27T18:48:00.000Z',
    rating: {
      stars: 5,
      feedback: 'The crispy masala dosa was steaming hot and arrived in under 12 minutes! Super smooth drop.',
      submittedAt: '2026-08-27T19:00:00.000Z',
    },
    timeline: [
      { status: 'Order Placed', timestamp: '6:30 PM', description: 'Order received', completed: true },
      { status: 'Order Confirmed', timestamp: '6:31 PM', description: 'Order verified', completed: true },
      { status: 'Preparing', timestamp: '6:33 PM', description: 'Food packaged in thermal container', completed: true },
      { status: 'Drone Assigned', timestamp: '6:35 PM', description: 'AeroSky Drone #02 assigned', completed: true },
      { status: 'Drone Launched', timestamp: '6:37 PM', description: 'Drone launched', completed: true },
      { status: 'Out for Delivery', timestamp: '6:38 PM', description: 'En route', completed: true },
      { status: 'Near Destination', timestamp: '6:45 PM', description: 'Approaching landing coordinates', completed: true },
      { status: 'Arriving', timestamp: '6:47 PM', description: 'Descending to 2m drop height', completed: true },
      { status: 'Delivered', timestamp: '6:48 PM', description: 'Delivered smoothly onto AstroTurf pad', completed: true },
    ],
  },
];

export const INITIAL_NOTIFICATIONS: CustomerNotification[] = [
  {
    id: 'notif_1',
    customerId: 'cust_984210',
    orderId: 'ORD-10245',
    title: 'Drone En Route! 🚀',
    message: 'Your delivery drone is cruising at safe altitude. Estimated arrival in 8 mins.',
    category: 'drone',
    read: false,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    actionUrl: '/tracking/ORD-10245',
  },
  {
    id: 'notif_2',
    customerId: 'cust_984210',
    orderId: 'ORD-10245',
    title: 'Delivery OTP Ready',
    message: 'Your handover OTP is 8492. Keep it ready when the drone arrives.',
    category: 'security',
    read: false,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    actionUrl: '/tracking/ORD-10245',
  },
  {
    id: 'notif_3',
    customerId: 'cust_984210',
    orderId: 'ORD-10190',
    title: 'Order Delivered 🎉',
    message: 'Order #ORD-10190 was delivered successfully. Tap to rate your flight experience.',
    category: 'order',
    read: true,
    createdAt: '2026-08-27T18:48:00.000Z',
    actionUrl: '/orders/ORD-10190',
  },
];

export const INITIAL_FAQS: FAQItem[] = [
  {
    id: 'faq_1',
    category: 'Drone Delivery',
    question: 'How does drone delivery work?',
    answer: 'Once you place an order, our fulfillment hub packages your items in an aerodynamic thermal cargo container. An autonomous electric delivery drone is assigned, takes off along designated commercial air corridors at ~65m altitude, navigates to your GPS drop-off marker, gently lowers the package from 2 meters, and ascends back.',
  },
  {
    id: 'faq_2',
    category: 'Safety & Drop-off',
    question: 'Where can the drone land or drop my package?',
    answer: 'Drones require an unobstructed 2.5m x 2.5m clear area. Ideal drop zones include backyard lawns, driveways, flat rooftop landing pads, and designated apartment landing beacons. The area should be free of overhead powerlines and thick tree branches.',
  },
  {
    id: 'faq_3',
    category: 'Orders & Tracking',
    question: 'How does the Delivery OTP work?',
    answer: 'For secure handover, your tracking screen displays a 4-digit Delivery OTP. Once the drone arrives and enters hovering drop mode, confirm the OTP in your app to release the package tether safely.',
  },
  {
    id: 'faq_4',
    category: 'Safety & Drop-off',
    question: 'What happens in bad weather or strong winds?',
    answer: 'Our systems monitor hyper-local weather sensors in real-time. If wind speeds exceed safe operational limits or severe rain occurs, flights are automatically placed on temporary hold or rerouted. You will be notified immediately.',
  },
  {
    id: 'faq_5',
    category: 'Payments & Refunds',
    question: 'Can I cancel an order once placed?',
    answer: 'You can cancel your order free of charge at any time before the drone departs the launchpad (during Order Placed, Confirmed, or Preparing stages). Once the drone has launched into the flight corridor, cancellation is locked to ensure flight safety.',
  },
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'TCK-8021',
    customerId: 'cust_984210',
    orderId: 'ORD-10190',
    category: 'General inquiry',
    subject: 'Rooftop landing beacon setup for office building',
    description: 'I would like to inquire about registering our office rooftop beacon ID for daily coffee deliveries.',
    status: 'Resolved',
    priority: 'Low',
    createdAt: '2026-08-25T14:10:00.000Z',
    updatedAt: '2026-08-26T09:20:00.000Z',
    messages: [
      {
        id: 'msg_1',
        sender: 'customer',
        senderName: 'Alex Mercer',
        message: 'I would like to inquire about registering our office rooftop beacon ID for daily coffee deliveries.',
        timestamp: '2026-08-25T14:10:00.000Z',
      },
      {
        id: 'msg_2',
        sender: 'support',
        senderName: 'SkyNav Support Team',
        message: 'Hi Alex! Your office address Horizon Tower 3 is already linked to Rooftop Pad #2. You can simply select it at checkout.',
        timestamp: '2026-08-26T09:20:00.000Z',
      },
    ],
  },
];
