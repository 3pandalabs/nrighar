import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../hooks/useAuth";

export default function TenantNoticeScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NRIGhar</Text>
      <Text style={styles.heading}>You&apos;re signed in as a tenant 🏠</Text>
      <Text style={styles.body}>
        The tenant experience lives on the web for now — manage your renter profile, documents,
        and sharing there. The tenant app is coming soon!
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => Linking.openURL("https://nrighar.3pandalabs.com/tenant")}
      >
        <Text style={styles.buttonText}>Open my renter profile</Text>
      </Pressable>
      <Pressable onPress={signOut}>
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  signOut: {
    textAlign: "center",
    marginTop: 20,
    color: "#2563eb",
    fontSize: 14,
  },
});
