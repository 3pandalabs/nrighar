import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { SITE_URL } from "../../lib/constants";
import {
  formatInr,
  type Lease,
  type PayLink,
  type Property,
  type RentPayment,
  type Tenant,
} from "../../lib/types";

export default function RentScreen() {
  const { session } = useAuth();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [payLinks, setPayLinks] = useState<PayLink[]>([]);
  const [upiVpa, setUpiVpa] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sendingLease, setSendingLease] = useState<string | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    const [
      { data: leaseRows },
      { data: props },
      { data: tenantRows },
      { data: paymentRows },
      { data: payLinkRows },
      { data: profile },
    ] = await Promise.all([
      supabase.from("leases").select("*").eq("status", "active"),
      supabase.from("properties").select("*"),
      supabase.from("tenants").select("*"),
      supabase.from("rent_payments").select("*").eq("period_year", year).eq("period_month", month),
      supabase.from("pay_links").select("*").eq("period_year", year).eq("period_month", month),
      session
        ? supabase.from("profiles").select("upi_vpa").eq("id", session.user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setLeases((leaseRows ?? []) as Lease[]);
    setProperties((props ?? []) as Property[]);
    setTenants((tenantRows ?? []) as Tenant[]);
    setPayments((paymentRows ?? []) as RentPayment[]);
    setPayLinks((payLinkRows ?? []) as PayLink[]);
    setUpiVpa((profile as { upi_vpa?: string | null } | null)?.upi_vpa ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  async function sendPayLink(lease: Lease, tenant: Tenant, property: Property | undefined) {
    if (!session || !tenant.phone) return;
    setSendingLease(lease.id);
    try {
      let payLinkUrl: string | null = null;
      if (upiVpa) {
        const { data, error } = await supabase
          .from("pay_links")
          .upsert(
            {
              owner_id: session.user.id,
              lease_id: lease.id,
              period_year: year,
              period_month: month,
              amount_due: Number(lease.rent_amount),
            },
            { onConflict: "lease_id,period_year,period_month" }
          )
          .select("id")
          .single();
        if (error) {
          Alert.alert("Could not create pay link", error.message);
          return;
        }
        payLinkUrl = `${SITE_URL}/pay/${data.id}`;
      }

      const rupees = formatInr(Number(lease.rent_amount));
      const propertyName = property?.nickname ?? "the property";
      const message = payLinkUrl
        ? `Hi ${tenant.full_name}, hope you're doing well! A gentle reminder that the rent of ${rupees} for ${propertyName} for ${monthLabel} is due. You can pay via UPI here: ${payLinkUrl} — it opens your UPI app with my details filled in. Thank you!`
        : `Hi ${tenant.full_name}, hope you're doing well! A gentle reminder that the rent of ${rupees} for ${propertyName} for ${monthLabel} is due. Please let me know once it's transferred. Thank you!`;

      const digits = tenant.phone.replace(/\D/g, "");
      const withCountry = digits.length === 10 ? `91${digits}` : digits;
      await Linking.openURL(`https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`);
      await load();
    } finally {
      setSendingLease(null);
    }
  }

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const paymentByLease = new Map(payments.map((p) => [p.lease_id, p]));
  const payLinkByLease = new Map(payLinks.map((p) => [p.lease_id, p]));

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={leases}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.month}>{monthLabel}</Text>
          {!upiVpa && (
            <Text style={styles.hint}>
              Add your UPI ID in Settings on the website and reminders will carry a pay link.
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No active leases — set them up on the web dashboard.</Text>
      }
      renderItem={({ item }) => {
        const property = propertyById.get(item.property_id);
        const tenant = tenantById.get(item.tenant_id);
        const payment = paymentByLease.get(item.id);
        const payLink = payLinkByLease.get(item.id);
        const overdue = !payment && now.getDate() > item.rent_due_day;
        const statusLabel =
          payment?.status === "paid"
            ? "Paid"
            : payment?.status === "partial"
              ? `Partial: ${formatInr(Number(payment.amount_paid ?? 0))}`
              : overdue
                ? "Overdue"
                : `Due (day ${item.rent_due_day})`;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.nickname}>{property?.nickname ?? "Property"}</Text>
              <Text
                style={[
                  styles.status,
                  payment?.status === "paid"
                    ? styles.statusPaid
                    : overdue
                      ? styles.statusOverdue
                      : styles.statusDue,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.detail}>
              {tenant?.full_name ?? "Tenant"} · {formatInr(Number(item.rent_amount))}/month
            </Text>
            {payment?.status !== "paid" && payLink && (
              <Text style={styles.payLinkStatus}>
                Pay link sent
                {payLink.opened_at ? " · opened ✓" : ""}
                {payLink.claimed_paid_at ? " · tenant says paid ✓ (confirm on web)" : ""}
              </Text>
            )}
            {payment?.status !== "paid" && tenant?.phone && (
              <Pressable
                style={styles.reminderButton}
                disabled={sendingLease === item.id}
                onPress={() => sendPayLink(item, tenant, property)}
              >
                <Text style={styles.reminderText}>
                  {sendingLease === item.id
                    ? "..."
                    : upiVpa
                      ? "WhatsApp pay link"
                      : "WhatsApp reminder"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  month: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: "#b45309",
    marginBottom: 8,
  },
  empty: {
    textAlign: "center",
    color: "#666",
    marginTop: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nickname: {
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusPaid: {
    color: "#059669",
  },
  statusDue: {
    color: "#b45309",
  },
  statusOverdue: {
    color: "#dc2626",
  },
  detail: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  payLinkStatus: {
    fontSize: 13,
    color: "#059669",
    marginTop: 6,
  },
  reminderButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#059669",
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  reminderText: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "600",
  },
});
