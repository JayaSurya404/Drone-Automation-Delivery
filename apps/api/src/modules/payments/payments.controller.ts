import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";

/**
 * Public by design (no `JwtAuthGuard`) — Stripe calls this directly.
 * Authenticity is instead verified from the payload itself via the
 * `Stripe-Signature` header (see `StripeProvider.verifyWebhookEvent`),
 * checked against the raw, unparsed body (`req.rawBody`, enabled app-wide
 * in `bootstrap.ts`) since the signature is computed over the exact bytes
 * Stripe sent.
 */
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("webhook/stripe")
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!req.rawBody) {
      throw new BadRequestException("Missing raw request body");
    }
    await this.paymentsService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
