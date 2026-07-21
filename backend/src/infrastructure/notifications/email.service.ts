import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

// ─── Email Template Types ─────────────────────────────────────────────────────

export interface WelcomeEmailData {
  firstName:   string;
  email:       string;
  loginUrl:    string;
}

export interface PasswordResetEmailData {
  firstName:   string;
  email:       string;
  resetToken:  string;
  resetUrl:    string;
  expiresInMinutes: number;
}

export interface PasswordChangedEmailData {
  firstName:   string;
  email:       string;
  loginUrl:    string;
  changedAt:   Date;
}

export interface AnalysisCompleteEmailData {
  firstName:     string;
  email:         string;
  requirementTitle: string;
  analysisId:    string;
  viewUrl:       string;
  aiProvider:    string;
  artifactCount: number;
  completedAt:   Date;
}

export interface EmailResult {
  messageId: string;
  accepted:  string[];
  rejected:  string[];
}

// ─── Email Service ────────────────────────────────────────────────────────────

export class EmailService {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly isDev: boolean;

  constructor() {
    this.isDev       = env.NODE_ENV !== 'production';
    this.fromAddress = env.FROM_EMAIL ?? 'noreply@reqai.app';

    if (this.isDev && !env.SMTP_HOST) {
      // Development: use Ethereal (auto-created test account on first send)
      this.transporter = nodemailer.createTransport({
        host:   'smtp.ethereal.email',
        port:   587,
        secure: false,
        auth: {
          user: env.SMTP_USER ?? '',
          pass: env.SMTP_PASS ?? '',
        },
      });
    } else {
      // Production: use configured SMTP
      this.transporter = nodemailer.createTransport({
        host:   env.SMTP_HOST,
        port:   env.SMTP_PORT ?? 587,
        secure: (env.SMTP_PORT ?? 587) === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        pool:            true,
        maxConnections:  5,
        maxMessages:     100,
        rateDelta:       1_000,
        rateLimit:       10,
      });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async sendWelcome(data: WelcomeEmailData): Promise<EmailResult> {
    return this.send({
      to:      data.email,
      subject: '👋 Welcome to ReqAI – Your account is ready',
      html:    this.tmplWelcome(data),
      text:    this.tmplWelcomeText(data),
    });
  }

  async sendPasswordReset(data: PasswordResetEmailData): Promise<EmailResult> {
    return this.send({
      to:      data.email,
      subject: '🔐 Reset your ReqAI password',
      html:    this.tmplPasswordReset(data),
      text:    this.tmplPasswordResetText(data),
    });
  }

  async sendPasswordChanged(data: PasswordChangedEmailData): Promise<EmailResult> {
    return this.send({
      to:      data.email,
      subject: '✅ Your ReqAI password was changed',
      html:    this.tmplPasswordChanged(data),
      text:    this.tmplPasswordChangedText(data),
    });
  }

  async sendAnalysisComplete(data: AnalysisCompleteEmailData): Promise<EmailResult> {
    return this.send({
      to:      data.email,
      subject: `✨ Analysis complete — "${data.requirementTitle}"`,
      html:    this.tmplAnalysisComplete(data),
      text:    this.tmplAnalysisCompleteText(data),
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('EmailService: SMTP connection verified');
      return true;
    } catch (err) {
      logger.warn('EmailService: SMTP connection failed', { error: err });
      return false;
    }
  }

  // ── Core send ─────────────────────────────────────────────────────────────

  private async send(opts: {
    to:      string;
    subject: string;
    html:    string;
    text:    string;
  }): Promise<EmailResult> {
    try {
      const info: SentMessageInfo = await this.transporter.sendMail({
        from:    `ReqAI <${this.fromAddress}>`,
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
        text:    opts.text,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info('EmailService: email sent', {
        to:        opts.to,
        subject:   opts.subject,
        messageId: info.messageId,
        ...(previewUrl && { previewUrl }),
      });

      return {
        messageId: info.messageId,
        accepted:  info.accepted ?? [],
        rejected:  info.rejected ?? [],
      };
    } catch (err) {
      logger.error('EmailService: failed to send email', { to: opts.to, subject: opts.subject, err });
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML TEMPLATES
  // Inline styles only — no external CSS — for maximum email client compat.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Shared layout wrapper ─────────────────────────────────────────────────

  private layout(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1A1A2E;border-radius:12px 12px 0 0;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">ReqAI</span>
                    <br/>
                    <span style="font-size:10px;font-weight:600;color:#00D4AA;letter-spacing:0.1em;text-transform:uppercase;">AI Requirement Analyzer</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#6C63FF,#00D4AA);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:40px;border-radius:0 0 12px 12px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#8B949E;line-height:1.6;">
                This email was sent by ReqAI · AI Requirement Analyzer<br/>
                If you did not request this, you can safely ignore this email.<br/>
                <a href="${env.FRONTEND_URL}" style="color:#6C63FF;text-decoration:none;">Visit ReqAI</a>
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

  private btn(label: string, href: string, color = '#6C63FF'): string {
    return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:${color};border-radius:8px;">
          <a href="${href}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.02em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
  }

  private divider(): string {
    return `<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />`;
  }

  private h1(text: string): string {
    return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1A1A2E;letter-spacing:-0.02em;">${text}</h1>`;
  }

  private p(text: string): string {
    return `<p style="margin:0 0 16px;font-size:15px;color:#1F2328;line-height:1.7;">${text}</p>`;
  }

  private small(text: string): string {
    return `<p style="margin:0;font-size:12px;color:#8B949E;line-height:1.6;">${text}</p>`;
  }

  private metaTable(rows: [string, string][]): string {
    const cells = rows.map(([k, v]) => `
      <tr>
        <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#57606A;text-transform:uppercase;background:#F7F8FA;border:1px solid #E5E7EB;">${k}</td>
        <td style="padding:8px 12px;font-size:13px;color:#1F2328;border:1px solid #E5E7EB;">${v}</td>
      </tr>`).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">${cells}</table>`;
  }

  // ── Welcome ───────────────────────────────────────────────────────────────

  private tmplWelcome(d: WelcomeEmailData): string {
    return this.layout('Welcome to ReqAI', `
      ${this.h1(`Welcome aboard, ${d.firstName}! 🎉`)}
      ${this.p(`Your ReqAI account has been created and is ready to use. Start transforming raw requirements into structured development artifacts in seconds.`)}
      ${this.divider()}
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#57606A;">WHAT YOU CAN DO WITH ReqAI</p>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#1F2328;line-height:2;">
        <li>Generate functional &amp; non-functional requirements</li>
        <li>Create REST API contracts and database schemas</li>
        <li>Produce Gherkin acceptance criteria automatically</li>
        <li>Score risks and estimate story points with AI</li>
        <li>Export reports as PDF, Markdown, or JSON</li>
      </ul>
      ${this.btn('Sign In to ReqAI →', d.loginUrl)}
      ${this.divider()}
      ${this.small(`Signed up as: ${d.email}`)}
    `);
  }

  private tmplWelcomeText(d: WelcomeEmailData): string {
    return `Welcome to ReqAI, ${d.firstName}!\n\nYour account is ready.\n\nSign in: ${d.loginUrl}\n\nReqAI – AI Requirement Analyzer`;
  }

  // ── Password Reset ────────────────────────────────────────────────────────

  private tmplPasswordReset(d: PasswordResetEmailData): string {
    return this.layout('Reset your password', `
      ${this.h1('Reset your password')}
      ${this.p(`Hi ${d.firstName}, we received a request to reset the password for your ReqAI account (<strong>${d.email}</strong>).`)}
      ${this.p(`Click the button below to choose a new password. This link will expire in <strong>${d.expiresInMinutes} minutes</strong>.`)}
      ${this.btn('Reset Password →', d.resetUrl)}
      ${this.divider()}
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#57606A;">TROUBLE CLICKING THE BUTTON?</p>
      ${this.p(`Copy and paste this URL into your browser:`)}
      <p style="margin:0 0 16px;font-size:12px;color:#6C63FF;word-break:break-all;font-family:monospace;">${d.resetUrl}</p>
      ${this.divider()}
      ${this.small(`If you did not request a password reset, no action is required — your password has <strong>not</strong> been changed.`)}
    `);
  }

  private tmplPasswordResetText(d: PasswordResetEmailData): string {
    return `Hi ${d.firstName},\n\nReset your ReqAI password:\n${d.resetUrl}\n\nThis link expires in ${d.expiresInMinutes} minutes.\n\nIf you didn't request this, ignore this email.`;
  }

  // ── Password Changed ──────────────────────────────────────────────────────

  private tmplPasswordChanged(d: PasswordChangedEmailData): string {
    return this.layout('Password changed', `
      ${this.h1('Password changed successfully')}
      ${this.p(`Hi ${d.firstName}, your ReqAI account password was changed successfully.`)}
      ${this.metaTable([
        ['Account',    d.email],
        ['Changed At', d.changedAt.toUTCString()],
      ])}
      ${this.p(`If you made this change, no action is needed.`)}
      <p style="margin:0 0 16px;font-size:15px;color:#EF4444;line-height:1.7;font-weight:600;">
        ⚠️  If you did NOT make this change, your account may be compromised. Please reset your password immediately.
      </p>
      ${this.btn('Sign In &amp; Secure Account →', d.loginUrl, '#EF4444')}
    `);
  }

  private tmplPasswordChangedText(d: PasswordChangedEmailData): string {
    return `Hi ${d.firstName},\n\nYour ReqAI password was changed at ${d.changedAt.toUTCString()}.\n\nIf you did not do this, reset your password immediately: ${d.loginUrl}`;
  }

  // ── Analysis Complete ─────────────────────────────────────────────────────

  private tmplAnalysisComplete(d: AnalysisCompleteEmailData): string {
    return this.layout('Analysis complete', `
      ${this.h1('Your analysis is ready ✨')}
      ${this.p(`Hi ${d.firstName}, your AI-powered analysis has completed. All <strong>${d.artifactCount} artifacts</strong> have been generated and are ready to review.`)}
      ${this.metaTable([
        ['Requirement', d.requirementTitle],
        ['Analysis ID', d.analysisId.slice(0, 8).toUpperCase()],
        ['AI Provider', d.aiProvider],
        ['Artifacts',   `${d.artifactCount} generated`],
        ['Completed',   d.completedAt.toUTCString()],
      ])}
      ${this.btn('View Analysis Results →', d.viewUrl)}
      ${this.divider()}
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#57606A;">YOUR ARTIFACTS INCLUDE</p>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:13px;color:#57606A;line-height:2;">
        <li>Executive Summary &amp; Complexity Score</li>
        <li>Functional &amp; Non-Functional Requirements</li>
        <li>REST API Contracts &amp; Database Schema</li>
        <li>Acceptance Criteria (Gherkin)</li>
        <li>Risk Register with P×I Scoring</li>
        <li>Development Tasks &amp; Story Points</li>
      </ul>
      ${this.divider()}
      ${this.small(`You can export this analysis as PDF, Markdown, or JSON from the analysis view.`)}
    `);
  }

  private tmplAnalysisCompleteText(d: AnalysisCompleteEmailData): string {
    return `Hi ${d.firstName},\n\nYour ReqAI analysis for "${d.requirementTitle}" is complete.\n\n${d.artifactCount} artifacts generated.\n\nView: ${d.viewUrl}\n\nReqAI – AI Requirement Analyzer`;
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!_emailService) {
    _emailService = new EmailService();
  }
  return _emailService;
}
