import nodemailer from 'nodemailer';

const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

if (!smtpUser || !smtpPassword) {
  throw new Error(
    'SMTP_USER and SMTP_PASSWORD environment variables are required.'
  );
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

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
  return transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      `CLEAR <${smtpUser}>`,
    to,
    subject,
    html,
    text,
  });
}
