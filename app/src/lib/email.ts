import nodemailer from 'nodemailer';

export async function sendMail(
  to: string,
  subject: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error during mail sending:', error);
    return { success: false, error: 'Internal error' };
  }
}
