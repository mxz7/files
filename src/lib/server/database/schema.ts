import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdIp: text("created_ip"),
  admin: integer("admin", { mode: "boolean" }).default(false),
  invite: text("invite").references(() => invites.id, { onDelete: "set null" }),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey().notNull(),
  label: text("label"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  usedBy: text("used_by").references(() => users.id, { onDelete: "cascade" }),
});

export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey().notNull(),
    label: text("label"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    createdIp: text("created_ip").notNull(),
    createdByUser: text("created_by_user").references(() => users.id, { onDelete: "set null" }),
    expireAt: integer("expire_at", { mode: "timestamp" }).notNull(),
    bytes: integer("bytes"), // will be null when file is not uploaded
  },
  (table) => ({
    userIdx: index("uploads_user_idx").on(table.createdByUser),
  }),
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});
