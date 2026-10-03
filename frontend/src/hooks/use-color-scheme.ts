import { useEffect } from "react";

/** Keeps the `dark` class on <html> in sync with the OS setting; index.html does the first paint. */
export function useColorScheme(): void {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
}
