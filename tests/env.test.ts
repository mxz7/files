import { beforeEach, describe, expect, it, vi } from "vitest";

const environment = vi.hoisted(() => ({ building: false }));
vi.mock("$app/env", () => environment);

const requiredNames = [
  "DB_URL",
  "DB_TOKEN",
  "CRON_SECRET",
  "S3_BUCKET",
  "S3_ENDPOINT",
  "S3_KEY_ID",
  "S3_ACCESS_KEY",
] as const;

describe("environment configuration", () => {
  beforeEach(() => {
    environment.building = false;
    vi.resetModules();
  });

  it("rejects missing and empty required values at runtime", async () => {
    const { variables } = await import("../src/env");
    for (const name of requiredNames) {
      const schema = variables[name].schema;
      expect(schema.safeParse(undefined).success, name).toBe(false);
      expect(schema.safeParse("").success, name).toBe(false);
      expect(schema.safeParse("configured").success, name).toBe(true);
    }
  });

  it("allows Loki to be unconfigured", async () => {
    const { variables } = await import("../src/env");
    for (const name of ["LOKI_HOST", "LOKI_USERNAME", "LOKI_PASSWORD", "LOKI_TENANT_ID"] as const) {
      expect(await variables[name].schema["~standard"].validate(undefined)).toEqual({ value: "" });
    }
  });

  it("allows builds without service credentials", async () => {
    environment.building = true;
    const { variables } = await import("../src/env");
    for (const name of requiredNames) {
      expect(variables[name].schema.parse(undefined), name).toBe("");
    }
  });
});
