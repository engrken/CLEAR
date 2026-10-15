// /lib/mailer.ts

import nodemailer from 'nodemailer';

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      'SMTP_USER and SMTP_PASSWORD environment variables are required to send emails.'
    );
  }

  const smtpPort = Number(process.env.SMTP_PORT || 465);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpPort === 465, // True for port 465, false for 587/other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      `CLEAR System <${smtpUser}>`,
    to,
    subject,
    html,
    text,
  });
}