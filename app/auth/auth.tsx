import { http } from "@/lib/http";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { login, register } from "@/lib/api"; // ✅ you created lib/api.ts in Step B

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const isSignUp = mode === "signup";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(""); // sign up only
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (isSignUp ? "Create account" : "Welcome back"),
    [isSignUp]
  );
  const subtitle = useMemo(
    () => (isSignUp ? "Start rating your scents." : "Sign in to continue."),
    [isSignUp]
  );

  const validate = () => {
    if (!email.trim()) return "Email is required.";
    if (!password.trim()) return "Password is required.";
    if (isSignUp && !username.trim()) return "Username is required.";
    return null;
  };

  const onSubmit = async () => {
  const v = validate();
  if (v) {
    setError(v);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    if (isSignUp) {
      console.log("🔵 REGISTER START");
      console.log("Sending to backend:", {
        email: email.trim(),
        username: username.trim(),
        passwordLength: password.trim().length,
      });

      // 1) Register
      const registerResponse = await register(
        email.trim(),
        password.trim(),
        username.trim()
      );

      console.log("🟢 REGISTER SUCCESS:", registerResponse);

      // 2) Login after register
      const session = await login(email.trim(), password.trim());

      console.log("🟢 LOGIN AFTER REGISTER SUCCESS:", session);

      console.log("🟢 LOGIN SUCCESS:", session);

      // 🔥 Print raw tokens (shortened for readability)
      console.log("Access Token (first 30):", session.access_token.slice(0, 30));
      console.log("Refresh Token (first 30):", session.refresh_token.slice(0, 30));

      // Save to storage
      
    } else {
      console.log("🔵 LOGIN START");
      console.log("Sending to backend:", {
        email: email.trim(),
        passwordLength: password.trim().length,
      });

      const session = await login(email.trim(), password.trim());

      console.log("🟢 LOGIN SUCCESS:", session);

      await AsyncStorage.multiSet([
      ["access_token", "fake_invalid_token"],              // ✅ force 401
      ["refresh_token", session.refresh_token],            // ✅ real refresh token
      ["profile", JSON.stringify(session.profile)],
      ["expires_at", String(session.expires_at ?? "")],
    ]);
      console.log("✅ SAVED TOKENS:");
      console.log("access_token:", "fake_invalid_token");
      console.log("refresh_token:", session.refresh_token?.slice(0, 12) + "…");
      console.log("expires_at:", session.expires_at);

      console.log("🧪 Now calling /api/user/me to force 401 -> refresh -> retry...");

      try {
        const me = await http.get("/api/user/me");
        console.log("✅ /me SUCCESS AFTER REFRESH:", me.data);
      } catch (err: any) {
        console.log("❌ /me FAILED:", err?.message ?? err);
        // If refresh failed, http.ts clears storage and throws "Session expired..."
        // So you can route back to auth if you want:
        // router.replace("/auth/auth");
      }

      router.replace("/(tabs)");
    }
  } catch (e: any) {
    console.log("🔴 AUTH ERROR:", e);
    setError(e?.message ?? "Something went wrong.");
  } finally {
    setLoading(false);
  }
};

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>Scent</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Email */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            {/* Username (Sign Up only) */}
            {isSignUp && (
              <View style={styles.inputWrap}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="yourname"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>
            )}

            {/* Password */}
            <View style={styles.inputWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.eyeBtn}
                  hitSlop={10}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#111"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isSignUp ? "Create account" : "Sign in"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Secondary actions */}
            {!isSignUp && (
              <TouchableOpacity onPress={() => {}} style={styles.forgotBtn} disabled={loading}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {isSignUp ? "Already have an account?" : "New here?"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMode(isSignUp ? "signin" : "signup");
                  setError(null);
                }}
                disabled={loading}
              >
                <Text style={styles.toggleLink}>
                  {isSignUp ? "Sign in" : "Create one"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tiny disclaimer */}
            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms & Privacy (placeholder).
            </Text>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },

  header: { marginTop: 12, marginBottom: 22 },
  appName: { fontSize: 16, fontWeight: "900", color: "#111", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "900", color: "#111" },
  subtitle: { fontSize: 14.5, color: "#777", marginTop: 8, lineHeight: 20 },

  form: { gap: 14 },

  errorText: {
    color: "#b00020",
    fontWeight: "800",
    fontSize: 13,
    backgroundColor: "#fde7ea",
    padding: 10,
    borderRadius: 12,
  },

  inputWrap: { gap: 8 },
  label: { fontSize: 12.5, fontWeight: "800", color: "#111" },
  input: {
    backgroundColor: "#f2f2f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15.5,
    color: "#111",
  },

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 14,
    paddingRight: 10,
  },
  eyeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtn: {
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },

  forgotBtn: { alignSelf: "flex-end", marginTop: 2 },
  forgotText: { color: "#111", fontWeight: "800", fontSize: 13 },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  toggleText: { color: "#666", fontSize: 13.5, fontWeight: "700" },
  toggleLink: { color: "#111", fontSize: 13.5, fontWeight: "900" },

  disclaimer: {
    marginTop: 16,
    textAlign: "center",
    color: "#888",
    fontSize: 12,
    lineHeight: 16,
  },
});