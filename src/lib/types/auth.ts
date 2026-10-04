import type { sessions } from "#lib/server/database/schema.js";

export type Session = typeof sessions.$inferSelect;
export type User = { id: string; username: string; admin: boolean };

export type Authed = {
  authenticated: true;
  user: User;
  session: Session;
};

export type Unauthed = {
  authenticated: false;
};
