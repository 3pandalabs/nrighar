import { publicGet } from "@/lib/api/public";
import { IntakeForm } from "./intake-form";

type IntakeLinkData = {
  status: "pending" | "submitted";
  expired: boolean;
  ownerName: string;
  propertyNickname: string | null;
  propertyCity: string | null;
};

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const data = uuidPattern.test(token)
    ? await publicGet<IntakeLinkData>(`/intake-links/${token}`)
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <p className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">RentVault</p>
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        {!data ? (
          <p className="text-center text-sm text-zinc-500">
            This link doesn&apos;t exist or has been removed. Please ask your landlord for a fresh
            one.
          </p>
        ) : data.expired && data.status === "pending" ? (
          <p className="text-center text-sm text-zinc-500">
            This link has expired. Please ask your landlord for a fresh one.
          </p>
        ) : data.status === "submitted" ? (
          <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-500">
            ✓ Details already submitted — your landlord has everything they need. Thank you!
          </p>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Tenant details
            </h1>
            <p className="mb-6 text-sm text-zinc-500">
              {data.ownerName} has asked for your details
              {data.propertyNickname
                ? ` for ${data.propertyNickname}, ${data.propertyCity}`
                : ""}{" "}
              to set up your tenancy.
            </p>
            <IntakeForm token={token} />
          </>
        )}
      </div>
      <p className="mt-6 max-w-md text-center text-xs text-zinc-400">
        Your documents go directly and only to your landlord — RentVault stores them privately and
        never shares them. Powered by RentVault · 3PandaLabs
      </p>
    </div>
  );
}
