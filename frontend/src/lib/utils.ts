import { createCn } from "cn/config"

// Every class carries the Tailwind prefix (see scripts/prefix-classes.mts). Without telling cn,
// it would not see that slagen:px-2 and slagen:px-4 conflict and would keep both.
export const cn = createCn({ prefix: "slagen" })
