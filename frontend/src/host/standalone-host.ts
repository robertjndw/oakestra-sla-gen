import { toast } from "sonner";
import type { PlaygroundHost } from "./host-context";

// Only the standalone app imports this. The dashboard brings its own toasts, and sonner's styles
// and portal shouldn't end up in the addon bundle.
export const standaloneHost: Partial<PlaygroundHost> = {
  notify: {
    success: (message, options) => void toast.success(message, options),
    error: (message, options) => void toast.error(message, options),
  },
};
