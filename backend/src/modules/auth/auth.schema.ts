import { z } from "zod";
import { parseMobile } from "../../lib/phone.js";

const mobileMessage = "Enter a 10-digit mobile number.";

export const mobileSchema = z.string().trim().transform((value, ctx) => {
  const phone = parseMobile(value);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: mobileMessage });
    return z.NEVER;
  }
  return phone;
});

export const loginSchema = z.object({
  phone: mobileSchema,
  password: z.string().min(1, "Enter your password."),
  device: z
    .object({
      deviceUid: z.string().min(3),
      platform: z.string().default("android"),
      appVersion: z.string().optional(),
    })
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const pushTokenSchema = z.object({
  token: z.string().trim().min(20).max(191),
  deviceUid: z.string().trim().min(3).max(191).optional(),
});

export const setPasswordSchema = z.object({
  userId: z.number().int().positive(),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(6, "New password must be at least 6 characters."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New password and confirm password do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.oldPassword !== value.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

export const registerOtpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const registerSchema = z.object({
  companyName: z.string().min(2, "Enter the company name."),
  name: z.string().min(2, "Enter the manager name."),
  phone: mobileSchema,
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});
