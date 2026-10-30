import { describe, expect, it } from "vitest";
import { isSecretEnv, isSecretKey, splitCmdSecrets } from "./secrets";

describe("isSecretKey", () => {
  it.each([
    "POSTGRES_PASSWORD",
    "MYSQL_ROOT_PASSWORD",
    "WORDPRESS_DB_PASSWORD",
    "DB_PASS",
    "DB_PWD",
    "REDIS_PASSWD",
    "JWT_SECRET",
    "SECRET_KEY_BASE",
    "GITHUB_TOKEN",
    "API_KEY",
    "STRIPE_KEY",
    "OPENAI_APIKEY",
    "AWS_SECRET_ACCESS_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "SSH_PRIVATE_KEY",
    "DBPASSWORD",
    "AUTHTOKEN",
    "apiKey",
    "dbPassword",
    "requirepass",
  ])("hides %s", (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each([
    "KEYCLOAK_URL",
    "MONKEY",
    "DONKEY_KONG",
    "PROXY_BYPASS",
    "COMPASS_MODE",
    "PWD",
    "POSTGRES_USER",
    "DB_HOST",
    "POSTGRES_PASSWORD_FILE",
    "TOKEN_URL",
    "SECRETS_DIR",
    "SSH_PUBLIC_KEY",
    "KEY_NAME",
    "",
  ])("shows %s", (key) => {
    expect(isSecretKey(key)).toBe(false);
  });
});

describe("isSecretEnv", () => {
  it("leaves flags and empty values alone even under a secret name", () => {
    expect(isSecretEnv("MYSQL_ALLOW_EMPTY_PASSWORD", "yes")).toBe(false);
    expect(isSecretEnv("REDIS_PASSWORD", "")).toBe(false);
    expect(isSecretEnv("REDIS_PASSWORD", "s3cret")).toBe(true);
  });

  it("hides connection strings with credentials in them", () => {
    expect(isSecretEnv("DATABASE_URL", "postgres://app:s3cret@10.30.0.1:5432/app")).toBe(true);
    expect(isSecretEnv("DATABASE_URL", "postgres://10.30.0.1:5432/app")).toBe(false);
    expect(isSecretEnv("API_URL", "http://10.30.0.2:8080")).toBe(false);
  });
});

describe("isSecretEnv URLs", () => {
  it("hides credentials in a URL, even for a key ending in URL", () => {
    expect(isSecretEnv("REDIS_URL", "redis://:s3cret@10.30.0.2:6379/0")).toBe(true);
    expect(isSecretEnv("DATABASE_URL", "postgres://app:s3cret@10.30.0.1/app")).toBe(true);
  });

  it("keeps a URL without credentials visible", () => {
    expect(isSecretEnv("REDIS_URL", "redis://10.30.0.2:6379/0")).toBe(false);
    expect(isSecretEnv("API_URL", "http://10.30.0.2:8080/a@b")).toBe(false);
  });
});

describe("splitCmdSecrets", () => {
  it("hides the value after a secret flag", () => {
    expect(splitCmdSecrets(["redis-server", "--requirepass", "s3cret"])).toEqual([
      { shown: "redis-server", hidden: "" },
      { shown: "--requirepass", hidden: "" },
      { shown: "", hidden: "s3cret" },
    ]);
  });

  it("keeps the flag name of an inline value visible", () => {
    expect(splitCmdSecrets(["--password=s3cret", "--port=6379"])).toEqual([
      { shown: "--password=", hidden: "s3cret" },
      { shown: "--port=6379", hidden: "" },
    ]);
  });

  it("doesn't take the next flag for a value", () => {
    expect(splitCmdSecrets(["--token", "--verbose"]).every((a) => a.hidden === "")).toBe(true);
  });

  it("hides the password of a URL with an empty user", () => {
    expect(splitCmdSecrets(["--url", "redis://:s3cret@10.30.0.2:6379/0"])[1]).toEqual({
      shown: "",
      hidden: "redis://:s3cret@10.30.0.2:6379/0",
    });
  });

  it("hides secret words inside a shell script argument", () => {
    expect(splitCmdSecrets(["sh", "-c", "redis-server --requirepass s3cret --port=6379 --masterauth=m4ster"])).toEqual([
      { shown: "sh", hidden: "" },
      { shown: "-c", hidden: "" },
      { shown: "redis-server", hidden: "" },
      { shown: "--requirepass", hidden: "" },
      { shown: "", hidden: "s3cret" },
      { shown: "--port=6379", hidden: "" },
      { shown: "--masterauth=", hidden: "m4ster" },
    ]);
  });

  it("leaves a harmless shell script visible", () => {
    expect(splitCmdSecrets(["sh", "-c", "echo hi"]).every((a) => a.hidden === "")).toBe(true);
  });
});
