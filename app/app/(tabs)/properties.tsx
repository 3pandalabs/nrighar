import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ScreenBackground } from "../../components/ScreenBackground";
import { api } from "../../lib/api";
import type { Lease, Property, Tenant } from "../../lib/types";

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeLeases, setActiveLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [props, leases, tenantRows] = await Promise.all([
      api.get<Property[]>("/properties"),
      api.get<Lease[]>("/leases"),
      api.get<Tenant[]>("/tenants"),
    ]);
    setProperties([...props].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    setActiveLeases(leases.filter((l) => l.status === "active"));
    setTenants(tenantRows);
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

  const leaseByProperty = new Map(activeLeases.map((l) => [l.propertyId, l]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return (
    <ScreenBackground>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={properties}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No properties yet — add them from the RentVault web dashboard.
          </Text>
        }
        renderItem={({ item }) => {
          const lease = leaseByProperty.get(item.id);
          const tenant = lease ? tenantById.get(lease.tenantId) : undefined;
          return (
            <View style={styles.card}>
              <Text style={styles.nickname}>{item.nickname}</Text>
              <Text style={styles.address}>
                {item.addressLine1}, {item.city}, {item.state} {item.pincode}
              </Text>
              <Text style={lease ? styles.rented : styles.vacant}>
                {lease ? `Rented to ${tenant?.fullName ?? "tenant"}` : "Vacant"}
              </Text>
            </View>
          );
        }}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 12,
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
  nickname: {
    fontSize: 17,
    fontWeight: "600",
  },
  address: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  rented: {
    marginTop: 8,
    fontSize: 14,
    color: "#059669",
  },
  vacant: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
  },
});
