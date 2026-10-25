"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAadhaarInput, isValidAadhaar } from "@/lib/identity";
import { startAadhaarVerification, submitAadhaarOtp } from "../actions";
import type { IdentityVerification } from "@/lib/types";

type Stage =
  | { step: "number" }
  | { step: "otp"; sessionId: string; numberMasked: string; reused: boolean }
  | { step: "done"; result: IdentityVerification };

export function AadhaarForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: "number" });
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const digits = aadhaar.replace(/\D/g, "");
  // Verhoeff runs in the browser, so a mistyped digit never becomes a paid OTP
  // — and, more to the point for the user, never becomes an SMS that doesn't
  // arrive and a minute spent wondering why.
  const looksValid = isValidAadhaar(digits);
  const showFormatHint = digits.length === 12 && !looksValid;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!looksValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    const response = await startAadhaarVerification(digits);
    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    if (response.data.alreadyVerified) {
      setError(null);
      setStage({ step: "number" });
      setAadhaar("");
      router.refresh();
      return;
    }

    // The number has done its job — drop it from component state before moving
    // on. From here the flow is driven by the session id, which is useless on
    // its own.
    setAadhaar("");
    setStage({
      step: "otp",
      sessionId: response.data.sessionId!,
      numberMasked: response.data.numberMasked,
      reused: response.data.reused,
    });
  }

  async function handleSubmitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (stage.step !== "otp" || otp.length < 4 || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    const response = await submitAadhaarOtp(stage.sessionId, otp);
    setIsSubmitting(false);
    setOtp("");

    if (!response.ok) {
      // The session survives a wrong OTP (minus one of its three attempts), so
      // the user retypes rather than paying for another SMS. Staying on this
      // step is the point.
      setError(response.error);
      return;
    }

    setStage({ step: "done", result: response.data });
    router.refresh();
  }

  if (stage.step === "done") {
    return (
      <div className="flex flex-col gap-3">
        {stage.result.status === "verified" ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            Aadhaar verified
            {stage.result.verifiedName ? ` as ${stage.result.verifiedName}` : ""}.
          </p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-400">
            The OTP was accepted, but the name on your Aadhaar
            {stage.result.verifiedName ? ` (${stage.result.verifiedName})` : ""} doesn&apos;t match
            the name on your profile. Your landlord will review this by hand.
          </p>
        )}
        <div>
          <button
            type="button"
            onClick={() => setStage({ step: "number" })}
            className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Verify a different Aadhaar
          </button>
        </div>
      </div>
    );
  }

  if (stage.step === "otp") {
    return (
      <form onSubmit={handleSubmitOtp} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {stage.reused
            ? // Explicit, because otherwise a user who pressed send twice waits
              // for a second SMS that is never coming.
              `You already have a code in progress for ${stage.numberMasked}. Enter the OTP you were sent — we haven't sent a new one.`
            : `We've sent a 6-digit OTP to the mobile number registered against ${stage.numberMasked}.`}
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          OTP
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-lg font-normal tracking-[0.3em] dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <p className="text-xs text-zinc-500">
          You have 3 attempts on this code. After that you&apos;ll need to request a new one.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={otp.length < 4 || isSubmitting}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {isSubmitting ? "Verifying…" : "Verify OTP"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage({ step: "number" });
              setOtp("");
              setError(null);
            }}
            className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Start over
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Aadhaar number
        <input
          value={aadhaar}
          onChange={(e) => setAadhaar(formatAadhaarInput(e.target.value))}
          placeholder="1234 5678 9012"
          inputMode="numeric"
          autoComplete="off"
          className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm font-normal tracking-wider dark:border-zinc-700 dark:bg-zinc-900"
        />
        {showFormatHint && (
          <span className="text-xs text-amber-700 dark:text-amber-500">
            That number doesn&apos;t check out — please re-check the digits.
          </span>
        )}
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="text-xs text-zinc-500">
        We&apos;ll send an OTP to the mobile number registered with your Aadhaar. We never store
        your full Aadhaar number — only the last four digits.
      </p>

      <div>
        <button
          type="submit"
          disabled={!looksValid || isSubmitting}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isSubmitting ? "Sending…" : "Send OTP"}
        </button>
      </div>
    </form>
  );
}
