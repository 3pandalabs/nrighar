import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import type { Tenant, TenantDocument, TenantProfile } from "../../lib/types";

const DOC_TYPE_LABELS: Record<TenantDocument["doc_type"], string> = {
  agreement: "Rent agreement",
  kyc: "ID / KYC",
  property_paper: "Property papers",
  tax: "Tax",
  other: "Other",
};

export default function TenantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const t = tenantRow as Tenant | null;
    setTenant(t);

    if (t?.tenant_user_id) {
      const [{ data: profileRow }, { data: docRows }] = await Promise.all([
        supabase.from("tenant_profiles").select("*").eq("user_id", t.tenant_user_id).maybeSingle(),
        supabase
          .from("tenant_documents")
          .select("*")
          .eq("tenant_user_id", t.tenant_user_id)
          .order("created_at", { ascending: false }),
      ]);
      setProfile((profileRow as TenantProfile | null) ?? null);
      setDocuments((docRows ?? []) as TenantDocument[]);
    } else {
      setProfile(null);
      setDocuments([]);
    }
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openDocument(doc: TenantDocument) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (data?.signedUrl) {
      Linking.openURL(data.signedUrl);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Tenants</Text>
      </Pressable>

      {isLoading ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : !tenant ? (
        <Text style={styles.empty}>Tenant not found.</Text>
      ) : (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{tenant.full_name}</Text>
            {(profile?.kyc_status ?? tenant.kyc_status) === "verified" && (
              <Text style={styles.badgeVerified}>Verified ✓</Text>
            )}
          </View>
          <Text style={styles.contact}>
            {[tenant.phone, tenant.email].filter(Boolean).join(" · ")}
          </Text>

          {tenant.tenant_user_id ? (
            profile ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Shared renter profile</Text>
                  <ProfileRow label="Full name" value={profile.full_name} />
                  <ProfileRow label="Phone" value={profile.phone} />
                  <ProfileRow label="Email" value={profile.email} />
                  <ProfileRow label="Current city" value={profile.current_city} />
                  <ProfileRow label="Employer" value={profile.employer} />
                  <ProfileRow label="KYC status" value={profile.kyc_status} />
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Shared documents</Text>
                  {documents.length === 0 && (
                    <Text style={styles.empty}>No documents in the shared profile yet.</Text>
                  )}
                  {documents.map((doc) => (
                    <Pressable key={doc.id} style={styles.docRow} onPress={() => openDocument(doc)}>
                      <View style={styles.docInfo}>
                        <Text style={styles.docTitle} numberOfLines={1}>
                          {doc.title}
                        </Text>
                        <Text style={styles.docType}>{DOC_TYPE_LABELS[doc.doc_type]}</Text>
                      </View>
                      <Text style={styles.link}>Open</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.warnCard}>
                <Text style={styles.warnText}>
                  This tenant has revoked access to their shared profile. Your own contact records
                  above remain.
                </Text>
              </View>
            )
          ) : (
            <Text style={styles.empty}>
              Added manually — no linked renter profile. Documents they submitted via an invite
              are in your document vault on the web.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    gap: 12,
  },
  back: {
    color: "#2563eb",
    fontSize: 15,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
  },
  badgeVerified: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "600",
  },
  contact: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  profileLabel: {
    fontSize: 14,
    color: "#666",
  },
  profileValue: {
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
  },
  docRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  docInfo: {
    flexShrink: 1,
    paddingRight: 12,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  docType: {
    fontSize: 12,
    color: "#999",
  },
  link: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "600",
  },
  warnCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 14,
  },
  warnText: {
    color: "#92400e",
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: "#666",
    fontSize: 14,
  },
});
