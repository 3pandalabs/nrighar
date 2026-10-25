import { providerEnv } from "../providers/env.js";
import type { IdentityKycProvider } from "./provider.js";
import { SurepassIdentityProvider } from "./surepass.js";

export * from "./provider.js";
export * from "./validate.js";

// Returns null when no identity provider is configured, rather than throwing
// or falling back to a stub that answers "verified".
//
// This mirrors the stance already taken in lib/kyc/officialVerify.ts: an
// unconfigured integration produces a `not_configured` row that a human has to
// clear, and nothing in the codebase is capable of manufacturing a passing
// verification. Adding a mock provider here would put that one env var away
// from being true in production.
export function getIdentityProvider(): IdentityKycProvider | null {
  switch (providerEnv.identityProvider) {
    case "surepass":
      return providerEnv.surepassToken ? new SurepassIdentityProvider() : null;
    default:
      return null;
  }
}
