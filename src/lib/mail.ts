import nodemailer from 'nodemailer';

export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('SMTP configuration is missing from environment variables.');
  }

  return nodemailer.createTransport({
    host: host || 'localhost',
    port: port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user: user || '',
      pass: pass || '',
    },
    tls: {
      rejectUnauthorized: false // bypass SSL verification issues if SMTP server cert is self-signed/local
    }
  });
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = getTransporter();
  const from = process.env.SMTP_USER || 'noreply@assetflow.com';

  try {
    const info = await transporter.sendMail({
      from: `"AssetFlow Notifications" <${from}>`,
      to,
      subject,
      html,
    });
    console.log(`Email successfully sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return { success: false, error };
  }
}
