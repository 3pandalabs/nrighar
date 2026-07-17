import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { formatInr, type Lease, type Property, type RentPayment, type Tenant } from "../../lib/types";

function whatsappReminderUrl(
  phone: string,
  tenantName: string,
  propertyNickname: string,
  amount: number,
  monthLabel: string
): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  const message =
    `Hi ${tenantName}, hope you're doing well! A gentle reminder that the rent of ` +
    `${formatInr(amount)} for ${propertyNickname} for ${monthLabel} is due. ` +
    `Please let me know once it's transferred. Thank you!`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export default function RentScreen() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [{ data: leaseRows }, { data: props }, { data: tenantRows }, { data: paymentRows }] =
      await Promise.all([
        supabase.from("leases").select("*").eq("status", "active"),
        supabase.from("properties").select("*"),
        supabase.from("tenants").select("*"),
        supabase.from("rent_payments").select("*").eq("period_year", year).eq("period_month", month),
      ]);

    setLeases((leaseRows ?? []) as Lease[]);
    setProperties((props ?? []) as Property[]);
    setTenants((tenantRows ?? []) as Tenant[]);
    setPayments((paymentRows ?? []) as RentPayment[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const paymentByLease = new Map(payments.map((p) => [p.lease_id, p]));

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={leases}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      ListHeaderComponent={<Text style={styles.month}>{monthLabel}</Text>}
      ListEmptyComponent={
        <Text style={styles.empty}>No active leases — set them up on the web dashboard.</Text>
      }
      renderItem={({ item }) => {
        const property = propertyById.get(item.property_id);
        const tenant = tenantById.get(item.tenant_id);
        const payment = paymentByLease.get(item.id);
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
            {payment?.status !== "paid" && tenant?.phone && (
              <Pressable
                style={styles.reminderButton}
                onPress={() =>
                  Linking.openURL(
                    whatsappReminderUrl(
                      tenant.phone!,
                      tenant.full_name,
                      property?.nickname ?? "the property",
                      Number(item.rent_amount),
                      monthLabel
                    )
                  )
                }
              >
                <Text style={styles.reminderText}>Send WhatsApp reminder</Text>
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
