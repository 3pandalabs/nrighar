import { apiFetch } from "@/lib/api/client";
import type { LeaseAgreementResponse, LeaseAgreementSigner } from "@/lib/types";
import { createLeaseAgreement } from "../../actions";
import { SendForSignatureButton, SignNowButton } from "./agreement-actions";

const STATUS_COPY: Record<
  LeaseAgreementResponse["agreement"]["status"],
  { label: string; detail: string; className: string }
> = {
  draft: {
    label: "Draft",
    detail: "Generated but not sent. Read it, then send it for signature.",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  sent: {
    label: "Waiting on you",
    detail: "Sent for signature. You sign first, then your tenant is invited.",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  partially_signed: {
    label: "Waiting on your tenant",
    detail: "You've signed. Your tenant has been invited to sign.",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  completed: {
    label: "Signed",
    detail: "Both parties have signed. The signed copy is in your documents.",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  declined: {
    label: "Declined",
    detail: "A signer declined. Create a new agreement to try again.",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  expired: {
    label: "Expired",
    detail: "The signing window closed. Create a new agreement to try again.",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  failed: {
    label: "Failed",
    detail: "Something went wrong with this agreement.",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
};

export async function AgreementSection({
  leaseId,
  propertyId,
}: {
  leaseId: string;
  propertyId: string;
}) {
  // null until an agreement has been generated for this lease.
  const data = (await apiFetch(`/leases/${leaseId}/agreement`).catch(
    () => null
  )) as LeaseAgreementResponse | null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Rental agreement
      </h2>

      {!data ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generate a rental agreement from this lease&apos;s terms. It&apos;s free to generate and
            read — you only send it for e-Signature when you&apos;re happy with it.
          </p>
          <form action={createLeaseAgreement}>
            <input type="hidden" name="lease_id" value={leaseId} />
            <input type="hidden" name="property_id" value={propertyId} />
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
            >
              Generate agreement
            </button>
          </form>
        </div>
      ) : (
        <AgreementDetail data={data} propertyId={propertyId} leaseId={leaseId} />
      )}
    </section>
  );
}

function AgreementDetail({
  data,
  propertyId,
  leaseId,
}: {
  data: LeaseAgreementResponse;
  propertyId: string;
  leaseId: string;
}) {
  const { agreement, signers, downloadUrl } = data;
  const status = STATUS_COPY[agreement.status];
  const landlord = signers.find((s) => s.role === "landlord");
  const isFinished = agreement.status === "completed";
  const isDead =
    agreement.status === "declined" || agreement.status === "expired" || agreement.status === "failed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
        <span className="text-sm text-zinc-500">{status.detail}</span>
      </div>

      <ol className="flex flex-col gap-2">
        {signers.map((signer) => (
          <SignerRow key={signer.id} signer={signer} />
        ))}
      </ol>

      {agreement.errorMessage && !isFinished && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {agreement.errorMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {isFinished ? "Open signed agreement" : "Read the draft"}
        </a>

        {agreement.status === "draft" && (
          <SendForSignatureButton agreementId={agreement.id} propertyId={propertyId} />
        )}

        {/* Only when it's genuinely the landlord's turn. Offering "Sign now"
            while the tenant is the pending signer would open a dead link. */}
        {agreement.status === "sent" && landlord?.status !== "signed" && (
          <SignNowButton agreementId={agreement.id} role="landlord" />
        )}
      </div>

      {isDead && (
        <form action={createLeaseAgreement}>
          <input type="hidden" name="lease_id" value={leaseId} />
          <input type="hidden" name="property_id" value={propertyId} />
          <button
            type="submit"
            className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Generate a new agreement
          </button>
        </form>
      )}

      {isFinished && (
        <p className="text-xs text-zinc-400">
          {/* Deliberately visible: the PDF itself carries this note, and a
              landlord who only ever reads the dashboard should still meet it. */}
          This agreement has not been stamped. Stamp duty is payable under your state&apos;s Stamp
          Act, and an unstamped agreement is admissible in evidence only after the duty and any
          penalty are paid.
        </p>
      )}
    </div>
  );
}

function SignerRow({ signer }: { signer: LeaseAgreementSigner }) {
  const label = signer.role === "landlord" ? "You (landlord)" : "Tenant";
  const state =
    signer.status === "signed"
      ? "Signed"
      : signer.status === "declined"
        ? "Declined"
        : signer.status === "notified"
          ? "Invited"
          : "Waiting their turn";

  return (
    <li className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-700 dark:text-zinc-300">
        <span className="mr-2 text-zinc-400">{signer.signOrder}.</span>
        {label} — {signer.fullName}
      </span>
      <span
        className={
          signer.status === "signed"
            ? "text-emerald-600 dark:text-emerald-400"
            : signer.status === "declined"
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500"
        }
      >
        {state}
      </span>
    </li>
  );
}
