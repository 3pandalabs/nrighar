import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { SITE_URL } from "../../lib/constants";
import type { IntakeLink, Tenant } from "../../lib/types";

export default function TenantsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invites, setInvites] = useState<IntakeLink[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const load = useCallback(async () => {
    const [{ data: tenantRows }, { data: inviteRows }] = await Promise.all([
      supabase.from("tenants").select("*").order("full_name"),
      supabase.from("intake_links").select("*").order("created_at", { ascending: false }),
    ]);
    setTenants((tenantRows ?? []) as Tenant[]);
    setInvites((inviteRows ?? []) as IntakeLink[]);
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

  async function shareInvite(url: string) {
    await Share.share({
      message: `Hi! Please fill in your tenant details and upload your documents (ID proof, and ideally your Aadhaar offline eKYC from myaadhaar.uidai.gov.in) here: ${url}`,
    });
  }

  async function createInvite() {
    if (!session) return;
    setIsInviting(true);
    const { data, error } = await supabase
      .from("intake_links")
      .insert({ owner_id: session.user.id })
      .select("id")
      .single();
    setIsInviting(false);
    if (error) {
      Alert.alert("Could not create invite", error.message);
      return;
    }
    await load();
    await shareInvite(`${SITE_URL}/join/${data.id}`);
  }

  const pendingInvites = invites.filter(
    (i) => i.status === "pending" && new Date(i.expires_at) > new Date()
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Pressable style={styles.inviteButton} disabled={isInviting} onPress={createInvite}>
        <Text style={styles.inviteButtonText}>
          {isInviting ? "..." : "+ Invite a tenant (share link)"}
        </Text>
      </Pressable>

      {pendingInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending invites</Text>
          {pendingInvites.map((invite) => (
            <View key={invite.id} style={styles.inviteRow}>
              <Text style={styles.inviteText}>
                Created {new Date(invite.created_at).toLocaleDateString()}
              </Text>
              <Pressable onPress={() => shareInvite(`${SITE_URL}/join/${invite.id}`)}>
                <Text style={styles.link}>Share again</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tenants</Text>
        {tenants.length === 0 && (
          <Text style={styles.empty}>No tenants yet — send an invite link above.</Text>
        )}
        {tenants.map((tenant) => (
          <Pressable
            key={tenant.id}
            style={styles.card}
            onPress={() => router.push(`/tenant-detail/${tenant.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{tenant.full_name}</Text>
              {tenant.kyc_status === "verified" ? (
                <Text style={styles.badgeVerified}>Verified ✓</Text>
              ) : tenant.tenant_user_id ? (
                <Text style={styles.badgeLinked}>Profile linked</Text>
              ) : (
                <Text style={styles.badgeManual}>Manual</Text>
              )}
            </View>
            <Text style={styles.detail}>
              {[tenant.phone, tenant.email].filter(Boolean).join(" · ") || "No contact info"}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  inviteButton: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  inviteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  inviteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inviteText: {
    fontSize: 13,
    color: "#666",
  },
  link: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "600",
  },
  empty: {
    color: "#666",
    fontSize: 14,
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
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  badgeVerified: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "600",
  },
  badgeLinked: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  badgeManual: {
    color: "#999",
    fontSize: 13,
  },
  detail: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
});
