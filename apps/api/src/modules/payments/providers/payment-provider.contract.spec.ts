import type { PaymentProviderAdapter } from "./payment-provider.interface";
import { SimulatedPaymentProvider } from "./simulated-payment.provider";
import { CodPaymentProvider } from "./cod-payment.provider";

/**
 * Phase 12 — shared contract test suite for any `PaymentProviderAdapter`
 * implementation, the same `drone-adapter.contract.spec.ts`/
 * `weather-provider.contract.spec.ts` precedent. `StripeProvider` is
 * deliberately NOT run through this suite — like `MavlinkDroneAdapter`/
 * `OpenMeteoProvider`, it requires real configuration (`STRIPE_SECRET_KEY`)
 * unavailable in this environment and throws by design when unconfigured
 * (see its own spec file, which proves exactly that); a contract suite
 * proves an implementation behaves like a real provider, which a
 * by-design-unconfigured stub cannot demonstrate.
 */
function runPaymentProviderContractTests(name: string, createProvider: () => PaymentProviderAdapter) {
  describe(`PaymentProviderAdapter contract — ${name}`, () => {
    const baseInput = { paymentId: "payment-1", orderId: "order-1", amount: 42.5, currency: "USD" };

    it("declares a `type` matching the PaymentProviderType enum", () => {
      const provider = createProvider();
      expect(["SIMULATED", "COD", "STRIPE"]).toContain(provider.type);
    });

    it("resolves with a non-empty providerReference and a valid status", async () => {
      const provider = createProvider();
      const result = await provider.initiate(baseInput);

      expect(typeof result.providerReference).toBe("string");
      expect(result.providerReference.length).toBeGreaterThan(0);
      expect(["succeeded", "pending", "failed"]).toContain(result.status);
    });

    it("resolves synchronously (never 'pending') — only a webhook-driven provider like Stripe would", async () => {
      const provider = createProvider();
      const result = await provider.initiate(baseInput);
      expect(result.status).not.toBe("pending");
    });

    it("produces a distinct providerReference per payment id", async () => {
      const provider = createProvider();
      const a = await provider.initiate({ ...baseInput, paymentId: "payment-a" });
      const b = await provider.initiate({ ...baseInput, paymentId: "payment-b" });
      expect(a.providerReference).not.toBe(b.providerReference);
    });

    it("carries a failureReason only when status is failed", async () => {
      const provider = createProvider();
      const result = await provider.initiate(baseInput);
      if (result.status !== "failed") {
        expect(result.failureReason).toBeUndefined();
      }
    });
  });
}

runPaymentProviderContractTests("SimulatedPaymentProvider", () => new SimulatedPaymentProvider());
runPaymentProviderContractTests("CodPaymentProvider", () => new CodPaymentProvider());

describe("PaymentProviderAdapter contract — SimulatedPaymentProvider decline behavior", () => {
  it("fails deterministically for Stripe's published decline test-card numbers", async () => {
    const provider = new SimulatedPaymentProvider();
    const result = await provider.initiate({ paymentId: "p1", orderId: "o1", amount: 10, currency: "USD", testCardNumber: "4000000000000002" });
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBeTruthy();
  });
});
