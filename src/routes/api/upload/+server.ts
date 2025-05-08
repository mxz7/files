import { nanoid } from "$lib/nanoid.js";
import db from "$lib/server/database/db.js";
import { uploads } from "$lib/server/database/schema.js";
import { lucia } from "$lib/server/lucia.js";
import { error, json } from "@sveltejs/kit";
import dayjs from "dayjs";
import { z } from "zod";

const schema = z.object({
  label: z.string().min(1).max(50),
  expire: z.number().min(0).max(3.154e12),
  bytes: z.number(),
  fileName: z.string().optional(),
});

export async function POST({ locals, getClientAddress, request }) {
  let auth = await locals.validate(false);

  if (!auth.authenticated && request.headers.get("authorization")) {
    const bearer = lucia.readBearerToken(request.headers.get("authorization")!);

    if (bearer) {
      const bearerAuth = await lucia.validateSession(bearer);

      if (bearerAuth.user) {
        auth = {
          authenticated: true,
          ...bearerAuth,
        };
      }
    }
  }

  if (!auth.authenticated) return error(401, { message: "Unauthorized" });

  let jsonData;
  try {
    jsonData = await request.json();
  } catch {
    return error(400);
  }

  const data = await schema.safeParseAsync(jsonData);

  if (!data.success) {
    return error(400, { message: data.error.message });
  }

  if (data.data.bytes > 1000000000) return error(400, { message: "File too large" });
  if (data.data.expire > 31556952000 && !auth.user.admin) return error(400);

  let id = nanoid();

  if (data.data.fileName) {
    id =
      encodeURIComponent(
        data.data.fileName
          .substring(0, 20)
          .toLowerCase()
          .trim()
          .replaceAll(" ", "-")
          .replaceAll("/", "-")
          .split(".")
          .slice(0, -1)
          .join("."),
      ) + `/${id}`;
  }

  await db.insert(uploads).values({
    createdIp: getClientAddress(),
    id,
    label: data.data.label,
    createdByUser: auth.user.id,
    expireAt: dayjs().add(data.data.expire, "milliseconds").toDate(),
    createdAt: new Date(),
  });

  return json({ id });
}
