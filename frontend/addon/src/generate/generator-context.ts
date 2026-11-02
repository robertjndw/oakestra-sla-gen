import { createContext, useContext } from "react";
import type { Application, Service } from "../types";

export interface GeneratorTarget {
  application: Application;
  services: Service[];
}

// The toolbar action only gets the playground's props, so the application it adds to comes
// through context. Kept in its own module so the button and the generator don't import each other.
export const GeneratorContext = createContext<GeneratorTarget | null>(null);

export function useGeneratorTarget(): GeneratorTarget {
  const target = useContext(GeneratorContext);
  if (!target) throw new Error("useGeneratorTarget() needs an ApplicationGenerator around it.");
  return target;
}
