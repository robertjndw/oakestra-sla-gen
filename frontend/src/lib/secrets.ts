/** Words that mark a key as secret when they appear as a whole word of it. */
const SECRET_WORDS = new Set([
  "PASSWORD",
  "PASSWD",
  "PASS",
  "PWD",
  "PASSPHRASE",
  "SECRET",
  "SECRETS",
  "TOKEN",
  "TOKENS",
  "KEY",
  "KEYS",
  "APIKEY",
  "CREDENTIAL",
  "CREDENTIALS",
  "CREDS",
  "PRIVATE",
  "SALT",
  // Redis flags, which the model writes as cmd arguments ("--requirepass s3cret").
  "REQUIREPASS",
  "MASTERAUTH",
]);

// Glued words like DBPASSWORD or AUTHTOKEN. Only long, unambiguous endings, since KEY or PASS as
// a suffix would also catch MONKEY or PROXY_BYPASS.
const SECRET_SUFFIXES = ["PASSWORD", "PASSWD", "SECRET", "TOKEN", "APIKEY", "ACCESSKEY", "PRIVATEKEY"];

// A key ending in one of these points at a secret (POSTGRES_PASSWORD_FILE, TOKEN_URL) rather than
// holding one, and hiding a path or URL only gets in the way.
const POINTER_WORDS = new Set(["FILE", "PATH", "DIR", "URL", "URI", "ENDPOINT", "HOST", "PORT", "NAME"]);

// Flags and toggles such as MYSQL_ALLOW_EMPTY_PASSWORD=yes; there's nothing to hide in those.
const TRIVIAL_VALUE = /^(|true|false|yes|no|on|off|0|1)$/i;

// user:password@ inside a connection string, e.g. DATABASE_URL=postgres://app:s3cret@10.30.0.1/app.
// The user may be empty, as in Redis URLs (redis://:s3cret@10.30.0.2:6379/0).
const URL_CREDENTIALS = /\/\/[^/\s:@]*:[^/\s@]+@/;

function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** Whether an environment variable or flag name looks like it holds a secret. */
export function isSecretKey(key: string): boolean {
  const parts = words(key);
  if (parts.length === 0) return false;
  // Bare PWD is the shell's working directory, not a password.
  if (parts.length === 1 && parts[0] === "PWD") return false;
  if (POINTER_WORDS.has(parts[parts.length - 1])) return false;
  const secret = parts.filter((p) => SECRET_WORDS.has(p) || SECRET_SUFFIXES.some((s) => p.endsWith(s)));
  if (secret.length === 0) return false;
  // SSH_PUBLIC_KEY is meant to be shared; PUBLIC only rescues a key that is otherwise just "KEY".
  if (parts.includes("PUBLIC") && secret.every((p) => p === "KEY" || p === "KEYS")) return false;
  return true;
}

/** Whether an environment value should be hidden by default. */
export function isSecretEnv(key: string, value: string): boolean {
  if (TRIVIAL_VALUE.test(value.trim())) return false;
  return isSecretKey(key) || URL_CREDENTIALS.test(value);
}

export interface CmdArg {
  /** The part that is always shown, e.g. "--password=" or a whole harmless argument. */
  shown: string;
  /** The part to hide by default; empty when nothing in this argument is secret. */
  hidden: string;
}

/**
 * Splits cmd arguments into what to show and what to hide: the value after a secret-looking
 * flag ("--requirepass", "s3cret"), the value of "--password=s3cret", and credentials in URLs.
 * An argument with whitespace is a shell script ("sh", "-c", "redis-server --requirepass s3cret"),
 * so it is split into words and each word is checked the same way; the result then has an entry
 * per word rather than per argument.
 */
export function splitCmdSecrets(cmd: string[]): CmdArg[] {
  return cmd.flatMap((raw, i): CmdArg[] => {
    const arg = String(raw);
    const inline = /^(--?([A-Za-z][\w-]*)=)(.*)$/.exec(arg);
    if (inline && isSecretEnv(inline[2], inline[3])) return [{ shown: inline[1], hidden: inline[3] }];
    if (inline) return [{ shown: arg, hidden: "" }];
    const flag = i > 0 ? /^--?([A-Za-z][\w-]*)$/.exec(String(cmd[i - 1])) : null;
    const afterSecretFlag = flag !== null && !arg.startsWith("-") && isSecretEnv(flag[1], arg);
    if (afterSecretFlag || URL_CREDENTIALS.test(arg)) return [{ shown: "", hidden: arg }];
    if (/\s/.test(arg.trim())) return splitCmdSecrets(arg.trim().split(/\s+/));
    return [{ shown: arg, hidden: "" }];
  });
}
