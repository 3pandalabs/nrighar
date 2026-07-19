import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenBackground } from "../../components/ScreenBackground";
import { useAuth } from "../../hooks/useAuth";

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    const result = mode === "sign-in" ? await signIn(email, password) : await signUp(email, password);

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.logoBadge}>
          <Text style={styles.logoGlyph}>🏠</Text>
        </View>
        <Text style={styles.title}>NRIGhar</Text>
        <Text style={styles.subtitle}>
          {mode === "sign-in" ? "Sign in to your account" : "Create an account"}
        </Text>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{mode === "sign-in" ? "Sign In" : "Sign Up"}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            }}
          >
            <Text style={styles.switchModeText}>
              {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoBadge: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoGlyph: {
    fontSize: 34,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  error: {
    color: "#dc2626",
    marginBottom: 12,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#059669",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchModeText: {
    textAlign: "center",
    marginTop: 20,
    color: "#059669",
    fontWeight: "600",
  },
});
