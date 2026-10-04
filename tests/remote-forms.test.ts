import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = vi.fn();
  const where = vi.fn();
  return {
    validate: vi.fn(),
    cookies: { set: vi.fn() },
    selectResults: [] as unknown[][],
    db: {
      select: vi.fn(),
      insert: vi.fn(() => ({ values })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where })) })),
    },
    values,
    where,
    send: vi.fn(),
    verify: vi.fn(),
    hash: vi.fn(),
    sessions: {
      createSession: vi.fn(),
      setSessionCookie: vi.fn(),
      generateSessionToken: vi.fn(() => "raw-token"),
      invalidateSession: vi.fn(),
      deleteSessionCookie: vi.fn(),
      invalidateUserSessions: vi.fn(),
    },
  };
});

vi.mock("$app/server", () => ({
  // Exercise handler logic without invoking SvelteKit's request dispatcher.
  form: (schemaOrHandler: object, handler?: object) =>
    Object.assign(handler ?? schemaOrHandler, { __: { type: "form" } }),
  query: (handler: () => unknown) =>
    Object.assign(() => Object.assign(Promise.resolve(handler()), { set: vi.fn() }), {
      __: { type: "query" },
    }),
  getRequestEvent: () => ({ locals: { validate: mocks.validate }, cookies: mocks.cookies }),
}));
vi.mock("$app/env/private", () => ({ S3_BUCKET: "test" }));
vi.mock("#lib/server/database/db.js", () => ({ default: mocks.db }));
vi.mock("#lib/server/auth/session.js", () => mocks.sessions);
vi.mock("#lib/server/s3.js", () => ({ s3: { send: mocks.send } }));
vi.mock("@node-rs/argon2", () => ({ hash: mocks.hash, verify: mocks.verify }));

import { login, signup } from "#lib/api/auth.remote.js";
import { renameFile } from "#lib/api/files.remote.js";
import { createInvite } from "#lib/api/invites.remote.js";
import { createKey, deleteKeys } from "#lib/api/keys.remote.js";

function run(remote: unknown, data?: unknown) {
  const issue = new Proxy(
    {},
    {
      get: (_, field) => (message: string) => ({ message, path: [field] }),
    },
  );
  return (remote as (data: unknown, issue: unknown) => Promise<unknown>)(data, issue);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResults.length = 0;
  mocks.validate.mockResolvedValue({ authenticated: false });
  mocks.db.select.mockImplementation(() => {
    const result = Promise.resolve(mocks.selectResults.shift() ?? []);
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      then: result.then.bind(result),
    };
    return chain;
  });
  mocks.sessions.createSession.mockResolvedValue({ id: "hashed-session", expiresAt: 2000000000 });
});

describe("remote mutation authorization", () => {
  it.each([
    ["rename", renameFile, { id: "file.txt", label: "Renamed", includeLabelInUrl: false }],
    ["create key", createKey, { days: 7 }],
    ["delete keys", deleteKeys, undefined],
    ["create invite", createInvite, { label: "Invite" }],
  ])("rejects unauthenticated %s calls before writing", async (_, remote, data) => {
    await expect(run(remote, data)).rejects.toMatchObject({ status: 401 });
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.sessions.createSession).not.toHaveBeenCalled();
    expect(mocks.sessions.invalidateUserSessions).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("requires admin privileges to create an invite", async () => {
    mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "user-1", admin: false } });
    await expect(run(createInvite, { label: "Invite" })).rejects.toMatchObject({ status: 401 });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("rejects renaming another user's upload without touching storage", async () => {
    mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "user-1" } });
    mocks.selectResults.push([{ createdBy: "other-user" }]);
    await expect(
      run(renameFile, { id: "file.txt", label: "Renamed", includeLabelInUrl: true }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("revokes the current user's sessions and expires their cookie", async () => {
    mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "user-1" } });
    await expect(run(deleteKeys)).rejects.toMatchObject({ status: 303, location: "/" });
    expect(mocks.sessions.invalidateUserSessions).toHaveBeenCalledWith("user-1");
    expect(mocks.sessions.deleteSessionCookie).toHaveBeenCalledWith(mocks.cookies);
  });
});

describe("remote authentication", () => {
  it("rejects incorrect credentials without creating a session", async () => {
    mocks.selectResults.push([{ userId: "user-1", password: "hash" }]);
    mocks.verify.mockResolvedValue(false);
    await expect(run(login, { username: "user", _password: "incorrect" })).rejects.toMatchObject({
      issues: [{ path: ["_password"], message: "Invalid credentials." }],
    });
    expect(mocks.sessions.createSession).not.toHaveBeenCalled();
  });

  it("sets a session cookie and redirects after a valid login", async () => {
    mocks.selectResults.push([{ userId: "user-1", password: "hash" }]);
    mocks.verify.mockResolvedValue(true);
    await expect(run(login, { username: "user", _password: "correct" })).rejects.toMatchObject({
      status: 303,
      location: "/files",
    });
    expect(mocks.sessions.createSession).toHaveBeenCalledWith("raw-token", "user-1");
    expect(mocks.sessions.setSessionCookie).toHaveBeenCalledWith(
      mocks.cookies,
      "raw-token",
      new Date(2000000000000),
    );
  });

  it("rejects invalid or consumed invites before creating a user", async () => {
    await expect(
      run(signup, { username: "user", _password: "password", _invite: "invalid" }),
    ).rejects.toMatchObject({ issues: [{ path: ["_invite"], message: "Invalid invite." }] });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("rejects an existing username before consuming the invite", async () => {
    mocks.selectResults.push([{ id: "invite" }], [{ username: "user" }]);
    await expect(
      run(signup, { username: "user", _password: "password", _invite: "invite" }),
    ).rejects.toMatchObject({ issues: [{ path: ["username"], message: "Invalid username." }] });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
});
