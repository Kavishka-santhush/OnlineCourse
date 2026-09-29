import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Nodemailer SMTP transport. Emails are dispatched fire-and-forget from
 * controllers via `sendMail`. React Email templates are rendered in
 * services/emailTemplates.js and passed as `html`.
 */
let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html, text, attachments }) {
  if (!to) return { skipped: true };
  try {
    const info = await getTransporter().sendMail({
      from: env.smtp.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
      attachments,
    });
    return { messageId: info.messageId };
  } catch (err) {
    // Never let an email failure break an API request.
    console.error('[mail] send failed:', err.message);
    return { error: err.message };
  }
}
