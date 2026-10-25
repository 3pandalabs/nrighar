import { providerEnv } from "../providers/env.js";
import type { ESignProvider } from "./provider.js";
import { LeegalityESignProvider } from "./leegality.js";

export * from "./provider.js";
export * from "./agreementPdf.js";

// Null when no e-Sign vendor is configured. Callers surface that as
// `esign_not_configured` (503) — the agreement PDF still generates and can be
// downloaded and signed on paper, which is a genuinely useful degraded mode
// and the reason PDF generation is a separate step from sending for signature.
export function getESignProvider(): ESignProvider | null {
  switch (providerEnv.esignProvider) {
    case "leegality":
      return providerEnv.leegalityAuthToken ? new LeegalityESignProvider() : null;
    default:
      return null;
  }
}
