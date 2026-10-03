import { useEffect, useState } from "react";
import { fetchInfo } from "@/lib/api";

/** Model name the server generates with, or null while loading or when the API is unreachable. */
export function useModelName(): string | null {
  const [model, setModel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchInfo().then(({ status, body }) => {
      if (!cancelled && status === 200 && body.model) setModel(body.model);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return model;
}
