import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { CodPaymentProvider } from "./providers/cod-payment.provider";
import { SimulatedPaymentProvider } from "./providers/simulated-payment.provider";
import { StripeProvider } from "./providers/stripe.provider";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, SimulatedPaymentProvider, CodPaymentProvider, StripeProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
