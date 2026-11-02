import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../common/logger.js";

export interface MailService { send(to: string, subject: string, text: string): Promise<void> }
function transport() {
  if (!env.SMTP_HOST) return nodemailer.createTransport({ jsonTransport: true }); // dev: no real delivery, never logs tokens here
  return nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined });
}
export const mailService: MailService = {
  async send(to, subject, text) {
    const from = env.EMAIL_FROM.trim();
    try { await transport().sendMail({ from, to, subject, text }); }
    catch (e) { logger.error({ mailError: (e as Error).message, from, toDomain: to.split("@")[1] }, "email delivery failed"); throw new Error("Email delivery failed", { cause: e }); }
  },
};
// Used by Better Auth callbacks; the URL contains a secret token — pass it only to the mail transport, never to logs.
export const sendAuthEmail = async (to: string, subject: string, url: string) =>
  mailService.send(to, subject, `${subject}: ${url}\nIf you did not request this, ignore this email.`);
