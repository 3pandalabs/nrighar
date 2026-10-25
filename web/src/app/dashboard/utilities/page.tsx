import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { formatInr } from "@/lib/currency";
import type { Property, UtilityAccount, UtilityBill, UtilityCategory } from "@/lib/types";
import { addUtilityAccount, deleteUtilityAccount, setUtilityAccountActive } from "../actions";
import { FetchNowButton } from "./fetch-now-button";

const CATEGORIES: [UtilityCategory, string][] = [
  ["electricity", "Electricity"],
  ["water", "Water"],
  ["gas", "Gas"],
  ["broadband", "Broadband"],
  ["dth", "DTH"],
  ["mobile", "Mobile"],
  ["maintenance", "Maintenance"],
  ["other", "Other"],
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES) as Record<UtilityCategory, string>;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00Z`).getTime();
  if (Number.isNaN(due)) return null;
  const days = Math.floor((Date.now() - due) / 86_400_000);
  return days > 0 ? days : null;
}

export default async function UtilitiesPage() {
  const [properties, accounts, bills] = await Promise.all([
    apiFetch("/properties") as Promise<Property[]>,
    apiFetch("/utility-accounts") as Promise<UtilityAccount[]>,
    apiFetch("/utility-bills") as Promise<UtilityBill[]>,
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));

  // Latest bill per account — the list only ever shows the current one, and
  // "latest" is by due date because that's what the landlord is watching.
  const latestBillByAccount = new Map<string, UtilityBill>();
  for (const bill of bills) {
    const existing = latestBillByAccount.get(bill.accountId);
    if (!existing || (bill.dueDate ?? "") > (existing.dueDate ?? "")) {
      latestBillByAccount.set(bill.accountId, bill);
    }
  }

  const overdue = bills.filter((b) => b.status === "UNPAID" && daysOverdue(b.dueDate) !== null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Utility bills</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Register the electricity, water or gas connection on a property and we&apos;ll check it
          for you — once when the month&apos;s bill is issued, and again on its due date. You&apos;ll
          get an email if one is still unpaid after that.
        </p>
      </div>

      {overdue.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            {overdue.length} unpaid {overdue.length === 1 ? "bill is" : "bills are"} past due
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-800 dark:text-amber-400">
            {overdue.map((bill) => {
              const account = accounts.find((a) => a.id === bill.accountId);
              const property = account ? propertyById.get(account.propertyId) : undefined;
              return (
                <li key={bill.id}>
                  {property?.nickname ?? "Unknown property"} ·{" "}
                  {account ? CATEGORY_LABELS[account.category] : "Utility"} ·{" "}
                  {formatInr(Number(bill.amountDue))} · {daysOverdue(bill.dueDate)} days overdue
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Registered connections
        </h2>
        {accounts.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {accounts.map((account) => {
              const property = propertyById.get(account.propertyId);
              const bill = latestBillByAccount.get(account.id);
              const late = bill ? daysOverdue(bill.dueDate) : null;

              return (
                <li key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {account.nickname || CATEGORY_LABELS[account.category]}
                      </span>
                      {!account.active && (
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Paused
                        </span>
                      )}
                      {/* Three strikes and the API stops polling this account.
                          Surfacing it is the difference between the landlord
                          fixing a typo and silently never being told again. */}
                      {account.consecutiveFailures >= 3 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
                          Checks paused after repeated failures
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500">
                      {property ? (
                        <Link href={`/dashboard/properties/${property.id}`} className="underline">
                          {property.nickname}
                        </Link>
                      ) : (
                        "Unknown property"
                      )}{" "}
                      · {account.billerName || account.billerId} ·{" "}
                      <span className="font-mono text-xs">{account.consumerNumber}</span>
                    </p>

                    {bill ? (
                      <p className="mt-1 text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatInr(Number(bill.amountDue))}
                        </span>{" "}
                        <span className="text-zinc-500">
                          due {formatDate(bill.dueDate)} ·{" "}
                          {bill.status === "PAID" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Paid</span>
                          ) : bill.status === "UNPAID" ? (
                            <span className={late ? "text-amber-700 dark:text-amber-400" : ""}>
                              Unpaid{late ? ` · ${late} days overdue` : ""}
                            </span>
                          ) : (
                            // We genuinely don't know, and the API never alerts
                            // on this — so the UI shouldn't imply otherwise.
                            <span>Status unknown</span>
                          )}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-zinc-500">No bill fetched yet.</p>
                    )}

                    <p className="mt-1 text-xs text-zinc-400">
                      Last checked {account.lastFetchedAt ? formatDate(account.lastFetchedAt) : "never"}
                      {account.nextFetchAfter && ` · next check ${formatDate(account.nextFetchAfter)}`}
                    </p>
                    {account.lastErrorMessage && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Last error: {account.lastErrorMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-start gap-3">
                    <FetchNowButton accountId={account.id} />
                    <form action={setUtilityAccountActive}>
                      <input type="hidden" name="id" value={account.id} />
                      <input type="hidden" name="active" value={account.active ? "false" : "true"} />
                      <button
                        type="submit"
                        className="whitespace-nowrap text-sm text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-50"
                      >
                        {account.active ? "Pause" : "Resume"}
                      </button>
                    </form>
                    <form action={deleteUtilityAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <button
                        type="submit"
                        className="text-sm text-zinc-500 underline hover:text-red-600 dark:hover:text-red-400"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            No connections registered yet. Add one below to start tracking its bills.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add a connection
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          The biller ID and consumer number are on the bill itself. Adding a connection
          doesn&apos;t check it straight away — the first check runs with the next monthly cycle,
          or press &ldquo;Check now&rdquo; once it&apos;s saved.
        </p>

        {properties.length > 0 ? (
          <form action={addUtilityAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Property">
              <select
                name="property_id"
                required
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Type">
              <select
                name="category"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Biller ID">
              <input
                name="biller_id"
                required
                placeholder="e.g. BESCOM00000NAT01"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>

            <Field label="Biller name (optional)">
              <input
                name="biller_name"
                placeholder="BESCOM"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>

            <Field label="Consumer number">
              <input
                name="consumer_number"
                required
                className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>

            <Field label="Label (optional)">
              <input
                name="nickname"
                placeholder="Flat 402 electricity"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              />
            </Field>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
              >
                Add connection
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-zinc-500">
            Add a{" "}
            <Link href="/dashboard/properties" className="underline">
              property
            </Link>{" "}
            first — utility connections attach to one.
          </p>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      {children}
    </label>
  );
}
