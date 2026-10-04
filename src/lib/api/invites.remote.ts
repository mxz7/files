import { form, getRequestEvent } from "$app/server";
import { nanoid } from "#lib/nanoid.js";
import db from "#lib/server/database/db.js";
import { invites } from "#lib/server/database/schema.js";
import { error } from "@sveltejs/kit";
import { z } from "zod";

export const createInvite = form(
  z.object({ label: z.string().trim().min(1) }),
  async ({ label }) => {
    const auth = await getRequestEvent().locals.validate();
    if (!auth.authenticated || !auth.user.admin) error(401, "Unauthorized");

    await db.insert(invites).values({ id: nanoid(32), createdAt: new Date(), label });
    return { success: true };
  },
);
