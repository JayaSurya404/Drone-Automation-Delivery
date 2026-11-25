import { calculateOrderPricing } from "./pricing.util";

describe("calculateOrderPricing", () => {
  const config = { deliveryFeeFlat: 4.99, freeDeliveryThreshold: 35, taxRate: 0.08 };

  it("charges the flat delivery fee and tax below the free-delivery threshold", () => {
    const pricing = calculateOrderPricing(20, config);
    expect(pricing.subtotal).toBe(20);
    expect(pricing.deliveryFee).toBe(4.99);
    expect(pricing.taxAmount).toBe(1.6);
    expect(pricing.totalAmount).toBe(26.59);
  });

  it("waives delivery at or above the free-delivery threshold", () => {
    const pricing = calculateOrderPricing(35, config);
    expect(pricing.deliveryFee).toBe(0);
    expect(pricing.totalAmount).toBe(37.8);
  });

  it("rounds to the nearest cent instead of drifting on float math", () => {
    const pricing = calculateOrderPricing(19.99, config);
    expect(pricing.taxAmount).toBe(1.6);
    expect(pricing.totalAmount).toBe(26.58);
  });
});
