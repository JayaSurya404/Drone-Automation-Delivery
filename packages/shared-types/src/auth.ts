import { z } from "zod";
import { publicUserSchema } from "./user";

const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(128)
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "password must contain at least one letter and one number");

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  expiresIn: z.number(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
