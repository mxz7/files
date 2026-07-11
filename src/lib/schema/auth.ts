import { object, string } from "zod";

export const loginSchema = object({
  username: string().toLowerCase(),
  password: string(),
});

export const signupSchema = object({
  invite: string().min(32).max(32),
  username: string()
    .toLowerCase()
    .min(1)
    .max(16)
    .regex(/^[a-z0-9_]{1,16}$/, "Invalid characters. a-z 0-9 only"),
  password: string().min(5).max(100),
});
