import { CRON_SECRET } from "$app/env/private";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { error } from "@sveltejs/kit";

const grantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  label: z.string().min(1).max(50),
  fileName: z.string().max(255),
  size: z.number().int().min(0).max(1_000_000_000),
  contentType: z.string().min(1).max(100),
  expire: z.number().min(0).max(3.154e12),
  anonymize: z.boolean(),
  expiresAt: z.number().int(),
});

export type UploadGrant = z.infer<typeof grantSchema>;

function sign(payload: string) {
  return createHmac("sha256", CRON_SECRET).update(`files-upload:${payload}`).digest();
}

export function createUploadGrant(grant: UploadGrant) {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");

  return `${payload}.${sign(payload).toString("base64url")}`;
}

export function readUploadGrant(token: string, userId: string, checkExpiry = true): UploadGrant {
  try {
    const parts = token.split(".");

    if (parts.length !== 2) throw new Error("Invalid grant");

    const [payload, signature] = parts;
    const provided = Buffer.from(signature, "base64url");
    const expected = sign(payload);

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
      throw new Error("Invalid signature");

    const grant = grantSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));

    if (grant.userId !== userId || (checkExpiry && Date.now() >= grant.expiresAt))
      throw new Error("Expired or unauthorized grant");

    return grant;
  } catch {
    error(400, "Invalid or expired upload. Please try again.");
  }
}
