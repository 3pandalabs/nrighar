import { createClient } from "@/lib/supabase/server";
import { monthLabel } from "@/lib/upi";
import { PayActions } from "./pay-actions";

type PayLinkData = {
  amount_due: number;
  period_year: number;
  period_month: number;
  property_nickname: string;
  property_city: string;
  tenant_name: string;
  owner_upi_vpa: string | null;
  owner_upi_name: string | null;
  claimed_paid_at: string | null;
};

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let data: PayLinkData | null = null;

  if (uuidPattern.test(token)) {
    const supabase = await createClient();
    const { data: result } = await supabase.rpc("get_pay_link", { p_token: token });
    data = (result as PayLinkData | null) ?? null;
  }

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
  }).format(Number(data.amount_due));

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-sm text-zinc-500">
            Rent for {data.property_nickname}, {data.property_city}
          </p>
          <p className="mt-1 text-4xl font-semibold text-zinc-900 dark:text-zinc-50">{rupees}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {monthLabel(data.period_year, data.period_month)}
          </p>
        </div>

        {data.owner_upi_vpa ? (
          <PayActions
            token={token}
            vpa={data.owner_upi_vpa}
            payeeName={data.owner_upi_name ?? "Landlord"}
            amount={Number(data.amount_due)}
            note={`Rent ${data.property_nickname} ${monthLabel(data.period_year, data.period_month)}`}
            alreadyClaimed={data.claimed_paid_at != null}
          />
        ) : (
          <p className="text-center text-sm text-zinc-500">
            Your landlord hasn&apos;t added their UPI ID yet — please pay them directly and let them
            know.
          </p>
        )}

        <p className="text-center text-xs text-zinc-400">
          Payment goes directly to your landlord via UPI — NRIGhar never handles the money. If your
          UPI app doesn&apos;t pre-fill the amount, enter {rupees} manually.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <p className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">NRIGhar</p>
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        {children}
      </div>
      <p className="mt-6 text-xs text-zinc-400">Powered by NRIGhar · 3PandaLabs</p>
    </div>
  );
}
