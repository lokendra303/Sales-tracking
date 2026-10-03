import { z } from "zod";

export const loginSchema = z.object({
  phone: z.string().min(8, "Enter a valid mobile number."),
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

export const registerSchema = z.object({
  companyName: z.string().min(2, "Enter the company name."),
  name: z.string().min(2, "Enter the manager name."),
  phone: z.string().min(8, "Enter a mobile number."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  email: z.string().email().optional().or(z.literal("")),
});
