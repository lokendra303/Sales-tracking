import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function fromHeader() {
  const from = env.smtp.from;
  if (from.includes("@")) return from;
  return { name: from, address: env.smtp.user };
}

export async function sendMail(to: string, subject: string, text: string) {
  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  await transport.sendMail({
    from: fromHeader(),
    to,
    subject,
    text,
  });
}
