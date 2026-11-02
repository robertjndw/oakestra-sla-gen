import type { OakestraApi } from "@oakestra/dashboard-sdk";

// Derived from the SDK's client so the addon needs no runtime (or even type) dependency on
// @oakestra/api, which is internal to the dashboard repository.
export type SlaV2 = Parameters<OakestraApi["applications"]["create"]>[0];
export type SlaApplication = SlaV2["applications"][number];
export type SlaMicroservice = SlaApplication["microservices"][number];
export type Application = Awaited<ReturnType<OakestraApi["applications"]["get"]>>;
export type Service = Awaited<ReturnType<OakestraApi["services"]["listForApplication"]>>[number];
export type ServiceCreateResult = Awaited<ReturnType<OakestraApi["services"]["create"]>>;
