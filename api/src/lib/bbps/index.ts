import { providerEnv } from "../providers/env.js";
import type { BbpsProvider } from "./provider.js";
import { SetuBbpsProvider } from "./setu.js";

export * from "./provider.js";

// Null when no BBPS vendor is configured. Utility accounts can still be
// registered and bills entered by hand — the tracker degrades to a manual
// ledger rather than disappearing, which is what a landlord who hasn't paid
// for bill-fetch should get.
export function getBbpsProvider(): BbpsProvider | null {
  switch (providerEnv.bbpsProvider) {
    case "setu":
      return providerEnv.setuClientId && providerEnv.setuClientSecret ? new SetuBbpsProvider() : null;
    default:
      return null;
  }
}
