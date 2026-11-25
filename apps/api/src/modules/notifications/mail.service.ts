import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { EnvConfig } from "../../config/env.validation";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Minimal local mail sender behind an adapter-shaped interface (blueprint
 * non-negotiable decision #3: never call a third-party SDK directly from
 * business logic). Only what Phase 2 needs — verification/reset emails via
 * Mailhog locally. The full event-driven NotificationChannel system
 * (multi-channel, NotificationLog, domain-event subscriptions) is Phase 4+.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService<EnvConfig, true>) {
    this.from = configService.get("SMTP_FROM", { infer: true });
    this.transporter = createTransport({
      host: configService.get("SMTP_HOST", { infer: true }),
      port: configService.get("SMTP_PORT", { infer: true }),
      secure: false,
    });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send mail to ${message.to}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}
