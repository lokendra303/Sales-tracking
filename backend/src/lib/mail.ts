import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

function fromHeader() {
  const from = env.smtp.from;
  if (from.includes("@")) return from;
  return { name: from, address: env.smtp.user };
}

let transport: Transporter | null = null;

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, text: string) {
  await getTransport().sendMail({
    from: fromHeader(),
    to,
    subject,
    text,
  });
}

/** Queue email without blocking the HTTP response. Calls onError if SMTP fails. */
export function queueMail(
  to: string,
  subject: string,
  text: string,
  onError?: (error: unknown) => void | Promise<void>,
) {
  void sendMail(to, subject, text).catch(async (error) => {
    console.error("SMTP send failed:", error instanceof Error ? error.message : error);
    try {
      await onError?.(error);
    } catch (cleanupError) {
      console.error("SMTP cleanup failed:", cleanupError);
    }
  });
}
