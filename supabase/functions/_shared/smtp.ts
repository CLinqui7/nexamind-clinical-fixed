import nodemailer from 'npm:nodemailer@9.1.1';

const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

function validAddress(value: string) {
  const address = String(value || '').trim();
  if (!emailPattern.test(address)) throw new Error('La dirección de correo no es válida.');
  return address;
}

export function smtpConfigured() {
  return Boolean(
    Deno.env.get('LINKARE_SMTP_USER')?.trim() &&
    Deno.env.get('LINKARE_SMTP_PASSWORD')?.trim() &&
    Deno.env.get('LINKARE_SMTP_FROM')?.trim()
  );
}

export async function sendSmtpEmail(recipient: string, subject: string, message: string) {
  if (!smtpConfigured()) throw new Error('El correo SMTP de Linkare no está configurado.');
  const user = validAddress(Deno.env.get('LINKARE_SMTP_USER')!);
  const from = validAddress(Deno.env.get('LINKARE_SMTP_FROM')!);
  const to = validAddress(recipient);
  const title = String(subject || '').replace(/[\r\n]/g, ' ').trim().slice(0, 160);
  if (!title) throw new Error('El asunto del correo es obligatorio.');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user, pass: Deno.env.get('LINKARE_SMTP_PASSWORD')!.trim() },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
  });
  try {
    const accepted = await transporter.sendMail({ from, to, subject: title, text: String(message || '') });
    if (!accepted.accepted?.some((address: string) => address.toLowerCase() === to.toLowerCase())) {
      throw new Error('El servidor SMTP no aceptó el destinatario.');
    }
    return { provider: 'gmail-smtp', id: String(accepted.messageId || '') };
  } finally {
    transporter.close();
  }
}
