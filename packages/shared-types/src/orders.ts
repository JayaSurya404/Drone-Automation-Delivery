import { z } from "zod";

export const customerAddressSchema = z.object({
  id: z.string(),
  userId: z.string(),
  label: z.string().nullable(),
  recipientName: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomerAddress = z.infer<typeof customerAddressSchema>;
export const customerAddressListSchema = z.array(customerAddressSchema);

export const createAddressRequestSchema = z.object({
  label: z.string().max(50).optional(),
  recipientName: z.string().max(100),
  line1: z.string().max(200),
  line2: z.string().max(200).optional(),
  city: z.string().max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20),
  country: z.string().max(2).optional(),
  phone: z.string().max(30).optional(),
  isDefault: z.boolean().optional(),
});
export type CreateAddressRequest = z.infer<typeof createAddressRequestSchema>;

export const updateAddressRequestSchema = createAddressRequestSchema.partial();
export type UpdateAddressRequest = z.infer<typeof updateAddressRequestSchema>;

export const orderStatusSchema = z.enum(["CREATED", "PAYMENT_PENDING", "PAID", "CONFIRMED", "PAYMENT_FAILED", "CANCELLED"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentProviderTypeSchema = z.enum(["SIMULATED", "COD", "STRIPE"]);
export type PaymentProviderType = z.infer<typeof paymentProviderTypeSchema>;

export const paymentStatusSchema = z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const orderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  unitPrice: z.number(),
  quantity: z.number(),
  lineTotal: z.number(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSummarySchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: orderStatusSchema,
  totalAmount: z.number(),
  currency: z.string(),
  itemCount: z.number(),
  createdAt: z.string(),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const orderPaymentSchema = z.object({
  provider: paymentProviderTypeSchema,
  status: paymentStatusSchema,
  failureReason: z.string().nullable(),
});

export const orderDetailSchema = orderSummarySchema.extend({
  userId: z.string(),
  subtotal: z.number(),
  deliveryFee: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
  shippingAddress: z.unknown(),
  deliverySlot: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  items: z.array(orderItemSchema),
  payment: orderPaymentSchema.nullable(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const paginatedOrdersSchema = z.object({
  orders: z.array(orderSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaginatedOrders = z.infer<typeof paginatedOrdersSchema>;

export const paymentMethodRequestSchema = z.object({
  type: paymentProviderTypeSchema,
  testCardNumber: z.string().max(30).optional(),
});
export type PaymentMethodRequest = z.infer<typeof paymentMethodRequestSchema>;

export const checkoutRequestSchema = z.object({
  addressId: z.string(),
  deliverySlot: z.string().max(100).optional(),
  paymentMethod: paymentMethodRequestSchema,
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const cancelOrderRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;

/** Stripe's own published test-card numbers — reused by SIMULATED for a recognizable, deterministic outcome. */
export const SIMULATED_TEST_CARDS = {
  success: "4242424242424242",
  decline: "4000000000000002",
} as const;
