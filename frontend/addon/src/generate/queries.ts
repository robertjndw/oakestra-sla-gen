import { addonQueryKey } from "@oakestra/dashboard-sdk";
import { ADDON_ID } from "virtual:oakestra-addon";

export const generatorKeys = {
  application: (applicationId: string) => addonQueryKey(ADDON_ID, "application", applicationId),
  services: (applicationId: string) => addonQueryKey(ADDON_ID, "services", applicationId),
};
