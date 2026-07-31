import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

type Message = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  variables?: Record<string, unknown>;
};

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(message: Message): Promise<void> {
    const webhook = this.config.get<string>('EMAIL_WEBHOOK_URL')?.trim();
    if (webhook) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: message.to,
          template: message.template,
          subject: message.subject,
          text: message.text,
          html: message.html,
          variables: message.variables,
        }),
      });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Email webhook rejected the message (${response.status})`,
        );
      }
      return;
    }

    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const from = this.config.get<string>('SMTP_FROM')?.trim();
    if (!host || !from) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured (set EMAIL_WEBHOOK_URL or SMTP_HOST and SMTP_FROM)',
      );
    }

    await this.smtp().sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private smtp(): Transporter {
    if (this.transporter) return this.transporter;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASSWORD');
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT', '25')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      requireTLS:
        this.config.get<string>('SMTP_REQUIRE_TLS', 'false') === 'true',
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized:
          this.config.get<string>('SMTP_TLS_REJECT_UNAUTHORIZED', 'true') ===
          'true',
      },
    });
    return this.transporter;
  }
}
