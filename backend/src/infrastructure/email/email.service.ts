import nodemailer from 'nodemailer';
import type { Transporter, SentMessageInfo } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to:          string;
  subject:     string;
  html:        string;
  text?:       string;
  replyTo?:    string;
}

export interface EmailResult {
  messageId: string;
  accepted:  string[];
  rejected:  string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EmailService
//
// Provides a thin, type-safe wrapper around nodemailer.
// Supports:
//   • Transactional SMTP (production)
//   • Ethereal test account (auto-created in development when SMTP_HOST is unset)
//   • Full HTML email templates for all auth flows
//
// All public methods are safe to call even if SMTP is unconfigured —
// they log a warning and return a stub result instead of throwing.
// ─────────────────────────────────────────────────────────────────────────────

export class EmailService {
  private transporter: Transporter | null = null;
  private fromAddress: string;
  private ready = false;

  constructor() {
    this.fromAddress = env.FROM_EMAIL ?? `noreply@reqai.app`;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Initialise the SMTP transporter.
   * Must be called once during application bootstrap (see server.ts).
   */
  async init(): Promise<void> {
    try {
      if (env.SMTP_HOST) {
        // ── Production / staging SMTP ──────────────────────────────────────
        this.transporter = nodemailer.createTransport({
          host:   env.SMTP_HOST,
          port:   env.SMTP_PORT ?? 587,
          secure: (env.SMTP_PORT ?? 587) === 465,
          auth:   {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
          pool:            true,
          maxConnections:  5,
          maxMessages:     100,
          rateDelta:       1_000,
          rateLimit:       10,
          connectionTimeout: 10_000,
          socketTimeout:     30_000,
        });

        await this.transporter.verify();
        this.ready = true;
        logger.info('EmailService: SMTP transporter verified', { host: env.SMTP_HOST });
      } else if (env.NODE_ENV !== 'production') {
        // ── Development: Ethereal catch-all account ────────────────────────
        const testAccount = await nodemailer.createTestAccount();
        this.transporter  = nodemailer.createTransport({
          host:   'smtp.ethereal.email',
          port:   587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.ready = true;
        logger.info('EmailService: Ethereal test account created', {
          user:     testAccount.user,
          preview:  'https://ethereal.email',
        });
      } else {
        logger.warn('EmailService: SMTP_HOST not set in production — emails will be skipped');
      }
    } catch (err: any) {
      logger.error('EmailService: Failed to initialise transporter', { error: err.message });
      // Non-fatal — the app can run without email
    }
  }

  // ── Core send ───────────────────────────────────────────────────────────────

  async send(opts: SendEmailOptions): Promise<EmailResult> {
    if (!this.transporter || !this.ready) {
      logger.warn('EmailService.send: transporter not ready — skipping email', {
        to:      opts.to,
        subject: opts.subject,
      });
      return { messageId: 'skipped', accepted: [], rejected: [opts.to] };
    }

    try {
      const info: SentMessageInfo = await this.transporter.sendMail({
        from:    `"ReqAI" <${this.fromAddress}>`,
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
        text:    opts.text ?? this.htmlToPlainText(opts.html),
        replyTo: opts.replyTo,
      });

      // Log preview URL when using Ethereal in development
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info('EmailService: Email preview available', { url: previewUrl });
      }

      logger.info('EmailService: Email sent', {
        messageId: info.messageId,
        to:        opts.to,
        subject:   opts.subject,
      });

      return {
        messageId: info.messageId as string,
        accepted:  (info.accepted ?? []).map(String),
        rejected:  (info.rejected ?? []).map(String),
      };
    } catch (err: any) {
      logger.error('EmailService: Failed to send email', {
        to:      opts.to,
        subject: opts.subject,
        error:   err.message,
      });
      return { messageId: 'error', accepted: [], rejected: [opts.to] };
    }
  }

  // ── Transactional templates ─────────────────────────────────────────────────

  /**
   * Send a password-reset email with a time-limited token link.
   * The token is a raw (pre-hash) UUID — the link embeds it as a query param.
   */
  async sendPasswordReset(opts: {
    to:        string;
    firstName: string;
    resetToken: string;
    expiresInMinutes?: number;
  }): Promise<EmailResult> {
    const expiresIn = opts.expiresInMinutes ?? 60;
    const resetUrl  = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(opts.resetToken)}`;

    return this.send({
      to:      opts.to,
      subject: 'Reset your ReqAI password',
      html:    this.buildPasswordResetHtml({
        firstName:  opts.firstName,
        resetUrl,
        expiresIn,
      }),
    });
  }

  /**
   * Send a welcome / email-verification email after registration.
   */
  async sendWelcome(opts: {
    to:              string;
    firstName:       string;
    verificationUrl: string;
  }): Promise<EmailResult> {
    return this.send({
      to:      opts.to,
      subject: 'Welcome to ReqAI – Verify your email',
      html:    this.buildWelcomeHtml(opts),
    });
  }

  /**
   * Send a notification that the password was successfully reset.
   */
  async sendPasswordResetConfirmation(opts: {
    to:        string;
    firstName: string;
  }): Promise<EmailResult> {
    return this.send({
      to:      opts.to,
      subject: 'Your ReqAI password has been changed',
      html:    this.buildPasswordChangedHtml(opts),
    });
  }

  /**
   * Send an analysis-complete notification with a link to view the results.
   */
  async sendAnalysisComplete(opts: {
    to:            string;
    firstName:     string;
    requirementTitle: string;
    analysisUrl:   string;
    artifactCount: number;
    aiProvider:    string;
    aiModel:       string;
  }): Promise<EmailResult> {
    return this.send({
      to:      opts.to,
      subject: `Analysis complete: "${opts.requirementTitle}"`,
      html:    this.buildAnalysisCompleteHtml(opts),
    });
  }

  // ── HTML builders ───────────────────────────────────────────────────────────

  private buildPasswordResetHtml(opts: {
    firstName:  string;
    resetUrl:   string;
    expiresIn:  number;
  }): string {
    return this.wrapInLayout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#1f2328">
        Reset your password
      </h1>
      <p style="margin:0 0 24px;color:#57606a;font-size:15px;line-height:1.6">
        Hi ${this.escape(opts.firstName)},
      </p>
      <p style="margin:0 0 24px;color:#57606a;font-size:15px;line-height:1.6">
        We received a request to reset the password for your ReqAI account.
        Click the button below to set a new password. This link expires in
        <strong>${opts.expiresIn} minutes</strong>.
      </p>
      ${this.ctaButton(opts.resetUrl, 'Reset Password')}
      <p style="margin:24px 0 0;color:#57606a;font-size:13px;line-height:1.6">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not be changed until you click the link above.
      </p>
      <p style="margin:8px 0 0;color:#57606a;font-size:13px">
        Or copy and paste this link: <a href="${opts.resetUrl}" style="color:#3b82d4">${opts.resetUrl}</a>
      </p>
    `);
  }

  private buildWelcomeHtml(opts: {
    firstName:       string;
    verificationUrl: string;
  }): string {
    return this.wrapInLayout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#1f2328">
        Welcome to ReqAI 🎉
      </h1>
      <p style="margin:0 0 24px;color:#57606a;font-size:15px;line-height:1.6">
        Hi ${this.escape(opts.firstName)},
      </p>
      <p style="margin:0 0 24px;color:#57606a;font-size:15px;line-height:1.6">
        Your account has been created. Please verify your email address to
        unlock all features — including AI requirement analysis.
      </p>
      ${this.ctaButton(opts.verificationUrl, 'Verify Email Address')}
      <p style="margin:24px 0 0;color:#57606a;font-size:13px;line-height:1.6">
        If you didn't create an account, you can safely ignore this email.
      </p>
    `);
  }

  private buildPasswordChangedHtml(opts: {
    firstName: string;
  }): string {
    return this.wrapInLayout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#1f2328">
        Password changed
      </h1>
      <p style="margin:0 0 24px;color:#57606a;font-size:15px;line-height:1.6">
        Hi ${this.escape(opts.firstName)},
      </p>
      <p style="margin:0 0 0;color:#57606a;font-size:15px;line-height:1.6">
        Your ReqAI account password was successfully changed. If you did not
        make this change, please reset your password immediately and contact
        our support team.
      </p>
    `);
  }

  private buildAnalysisCompleteHtml(opts: {
    firstName:        string;
    requirementTitle: string;
    analysisUrl:      string;
    artifactCount:    number;
    aiProvider:       string;
    aiModel:          string;
  }): string {
    return this.wrapInLayout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#1f2328">
        Analysis complete ✅
      </h1>
      <p style="margin:0 0 24px;color:#57606a;font-size:15px;line-height:1.6">
        Hi ${this.escape(opts.firstName)},
      </p>
      <p style="margin:0 0 16px;color:#57606a;font-size:15px;line-height:1.6">
        Your AI analysis for <strong>"${this.escape(opts.requirementTitle)}"</strong>
        has completed successfully.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <tr style="background:#f7f8fa">
          <td style="padding:10px 16px;font-size:13px;color:#57606a;border-bottom:1px solid #e5e7eb">Artifacts generated</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1f2328;border-bottom:1px solid #e5e7eb;text-align:right">${opts.artifactCount}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#57606a;border-bottom:1px solid #e5e7eb">AI Provider</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1f2328;border-bottom:1px solid #e5e7eb;text-align:right">${this.escape(opts.aiProvider)}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#57606a">Model</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1f2328;text-align:right">${this.escape(opts.aiModel)}</td>
        </tr>
      </table>
      ${this.ctaButton(opts.analysisUrl, 'View Analysis Results')}
    `);
  }

  // ── Layout helpers ──────────────────────────────────────────────────────────

  private wrapInLayout(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ReqAI</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,'Segoe UI',system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;background:#ffffff;border-radius:12px 12px 0 0;border:1px solid #e5e7eb;border-bottom:none">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:10px">
                      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6C63FF,#8A85FF);display:inline-block"></div>
                      <span style="font-size:18px;font-weight:800;color:#1f2328;letter-spacing:-0.02em">ReqAI</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 32px;background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;background:#f7f8fa;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
              <p style="margin:0;font-size:12px;color:#57606a;line-height:1.5">
                This email was sent by ReqAI. If you have questions, reply to this email
                or visit <a href="${env.FRONTEND_URL}" style="color:#3b82d4">${env.FRONTEND_URL}</a>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#8c959f">
                © ${new Date().getFullYear()} ReqAI. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private ctaButton(url: string, label: string): string {
    return `
      <table cellpadding="0" cellspacing="0" style="margin:0 0 16px">
        <tr>
          <td style="border-radius:8px;background:linear-gradient(135deg,#6C63FF,#8A85FF)">
            <a href="${url}" target="_blank"
               style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em">
              ${label} →
            </a>
          </td>
        </tr>
      </table>`;
  }

  private htmlToPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const emailService = new EmailService();
