import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenBackground } from "../../components/ScreenBackground";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { formatInr, type Lease, type RentPayment } from "../../lib/types";

export default function OverviewScreen() {
  const { session, signOut } = useAuth();
  const [propertyCount, setPropertyCount] = useState(0);
  const [expected, setExpected] = useState(0);
  const [collected, setCollected] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [{ count }, { data: leases }, { data: payments }] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }),
      supabase.from("leases").select("*").eq("status", "active"),
      supabase
        .from("rent_payments")
        .select("*")
        .eq("period_year", year)
        .eq("period_month", month),
    ]);

    const activeLeases = (leases ?? []) as Lease[];
    const monthPayments = (payments ?? []) as RentPayment[];
    const paidLeaseIds = new Set(
      monthPayments.filter((p) => p.status === "paid").map((p) => p.lease_id)
    );

    setPropertyCount(count ?? 0);
    setExpected(activeLeases.reduce((sum, l) => sum + Number(l.rent_amount), 0));
    setCollected(monthPayments.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0));
    setPendingCount(activeLeases.filter((l) => !paidLeaseIds.has(l.id)).length);
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

  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.greeting}>Namaste 🙏</Text>
        <Text style={styles.subtitle}>{monthLabel} at a glance</Text>

        <View style={styles.cardRow}>
          <StatCard label="Properties" value={String(propertyCount)} />
          <StatCard label="Awaiting rent" value={String(pendingCount)} />
        </View>
        <View style={styles.cardRow}>
          <StatCard label="Expected" value={formatInr(expected)} />
          <StatCard label="Collected" value={formatInr(collected)} />
        </View>

        <Text style={styles.email}>{session?.user.email}</Text>
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </ScreenBackground>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 16,
  },
  cardLabel: {
    fontSize: 13,
    color: "#666",
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  email: {
    marginTop: 32,
    textAlign: "center",
    color: "#999",
    fontSize: 13,
  },
  signOutButton: {
    marginTop: 12,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  signOutText: {
    fontSize: 14,
    color: "#333",
  },
});
