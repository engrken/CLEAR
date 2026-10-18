import 'server-only';
import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html, text }: {
  to: string; subject: string; html: string; text?: string;
}) {
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  if (!username || !password) throw new Error('SMTP_USER and SMTP_PASSWORD must be configured.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP_PORT.');
  if (!to.trim() || !subject.trim()) throw new Error('Email recipient and subject are required.');
  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user: username, pass: password },
    // Avoid hanging indefinitely during an unavailable mail-provider connection.
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  });
  return transporter.sendMail({
    from: process.env.MAIL_FROM || `CLEAR System <${username}>`,
    to, subject, html, text,
  });
}
