import { roundMoney } from "../../common/money.util";

export interface PricingConfig {
  deliveryFeeFlat: number;
  freeDeliveryThreshold: number;
  taxRate: number;
}

export interface OrderPricing {
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
}

/** Simple unit pricing + flat/threshold delivery fee for v1 (blueprint Section P) — coupons/promotions are a v2 addition. */
export function calculateOrderPricing(subtotal: number, config: PricingConfig): OrderPricing {
  const deliveryFee = subtotal >= config.freeDeliveryThreshold ? 0 : config.deliveryFeeFlat;
  const taxAmount = roundMoney(subtotal * config.taxRate);
  const totalAmount = roundMoney(subtotal + deliveryFee + taxAmount);
  return { subtotal: roundMoney(subtotal), deliveryFee: roundMoney(deliveryFee), taxAmount, totalAmount };
}
