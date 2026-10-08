import nodemailer from 'nodemailer';
import { renderEmail } from '@/lib/email-template';

type MailOptions = {
  title?: string;
  label?: string;
  code?: string;
  cta?: { label: string; url: string };
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail(
  to: string,
  subject: string,
  message: string,
  options: MailOptions = {},
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text: message,
      html: renderEmail({
        title: options.title ?? subject,
        message,
        label: options.label,
        code: options.code,
        cta: options.cta,
      }),
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error during mail sending:', error);
    return { success: false, error: 'Internal error' };
  }
}
