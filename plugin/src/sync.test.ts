import { describe, it, expect } from "vitest";
import { gatherSyncSecrets } from "./cli";

describe("gatherSyncSecrets", () => {
  it("returns empty object when env is empty", () => {
    expect(gatherSyncSecrets({})).toEqual({});
  });

  it("syncs all env vars with values", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-abc123",
      GITHUB_TOKEN: "ghp_abc",
      DATABASE_URL: "postgres://localhost/mydb",
      MY_CUSTOM_VAR: "hello",
    };
    expect(gatherSyncSecrets(env)).toEqual(env);
  });

  it("omits empty values", () => {
    const env = {
      GITHUB_TOKEN: "ghp_abc",
      EMPTY_VAR: "",
    };
    expect(gatherSyncSecrets(env)).toEqual({ GITHUB_TOKEN: "ghp_abc" });
  });

  it("excludes VIAGEN_ENVIRONMENT_ID (local-only)", () => {
    const env = {
      VIAGEN_ENVIRONMENT_ID: "proj_123",
      GITHUB_TOKEN: "ghp_abc",
    };
    expect(gatherSyncSecrets(env)).toEqual({ GITHUB_TOKEN: "ghp_abc" });
  });

  it("excludes VIAGEN_PLATFORM_URL (local-only)", () => {
    const env = {
      VIAGEN_PLATFORM_URL: "https://platform.viagen.dev",
      GITHUB_TOKEN: "ghp_abc",
    };
    expect(gatherSyncSecrets(env)).toEqual({ GITHUB_TOKEN: "ghp_abc" });
  });

  it("excludes Infisical credentials (local-only)", () => {
    const env = {
      INFISICAL_CLIENT_ID: "inf-id",
      INFISICAL_CLIENT_SECRET: "inf-secret",
      INFISICAL_PROJECT_ID: "inf-proj",
      GITHUB_TOKEN: "ghp_abc",
    };
    expect(gatherSyncSecrets(env)).toEqual({ GITHUB_TOKEN: "ghp_abc" });
  });

  it("excludes all deny-listed keys together", () => {
    const env = {
      VIAGEN_ENVIRONMENT_ID: "proj_123",
      VIAGEN_PLATFORM_URL: "https://platform.viagen.dev",
      INFISICAL_CLIENT_ID: "inf-id",
      INFISICAL_CLIENT_SECRET: "inf-secret",
      INFISICAL_PROJECT_ID: "inf-proj",
      ANTHROPIC_API_KEY: "sk-ant-key",
      MY_APP_SECRET: "s3cret",
    };
    expect(gatherSyncSecrets(env)).toEqual({
      ANTHROPIC_API_KEY: "sk-ant-key",
      MY_APP_SECRET: "s3cret",
    });
  });
});
