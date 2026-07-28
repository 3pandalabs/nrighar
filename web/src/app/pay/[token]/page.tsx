import { publicGet } from "@/lib/api/public";
import { monthLabel } from "@/lib/upi";
import { Wordmark } from "@/components/Wordmark";
import { PayActions } from "./pay-actions";

type PayLinkData = {
  amountDue: number;
  periodYear: number;
  periodMonth: number;
  propertyNickname: string;
  propertyCity: string;
  tenantName: string;
  ownerUpiVpa: string | null;
  ownerUpiName: string | null;
  claimedPaidAt: string | null;
};

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const data = uuidPattern.test(token) ? await publicGet<PayLinkData>(`/pay-links/${token}`) : null;

  if (!data) {
    return (
      <Shell>
        <p className="text-center text-sm text-zinc-500">
          This payment link doesn&apos;t exist or has been removed. Please ask your landlord for a
          fresh link.
        </p>
      </Shell>
    );
  }

  const rupees = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(data.amountDue));

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-sm text-zinc-500">
            Rent for {data.propertyNickname}, {data.propertyCity}
          </p>
          <p className="mt-1 text-4xl font-semibold text-zinc-900 dark:text-zinc-50">{rupees}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {monthLabel(data.periodYear, data.periodMonth)}
          </p>
        </div>

        {data.ownerUpiVpa ? (
          <PayActions
            token={token}
            vpa={data.ownerUpiVpa}
            payeeName={data.ownerUpiName ?? "Landlord"}
            amount={Number(data.amountDue)}
            note={`Rent ${data.propertyNickname} ${monthLabel(data.periodYear, data.periodMonth)}`}
            alreadyClaimed={data.claimedPaidAt != null}
          />
        ) : (
          <p className="text-center text-sm text-zinc-500">
            Your landlord hasn&apos;t added their UPI ID yet — please pay them directly and let them
            know.
          </p>
        )}

        <p className="text-center text-xs text-zinc-400">
          Payment goes directly to your landlord via UPI — RentVault never handles the money. If your
          UPI app doesn&apos;t pre-fill the amount, enter {rupees} manually.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <p className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <Wordmark />
      </p>
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        {children}
      </div>
      <p className="mt-6 text-xs text-zinc-400">Powered by RentVault · 3PandaLabs</p>
    </div>
  );
}
