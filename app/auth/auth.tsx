import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
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

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const isSignUp = mode === "signup";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(""); // sign up only
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const title = useMemo(() => (isSignUp ? "Create account" : "Welcome back"), [isSignUp]);
  const subtitle = useMemo(
    () => (isSignUp ? "Start rating your scents." : "Sign in to continue."),
    [isSignUp]
  );

  const onSubmit = () => {
    // ✅ UI-only for now. Later you’ll call backend auth here.
    // For now: go straight to the main tabs.
    router.replace("/(tabs)");
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
                returnKeyType={isSignUp ? "next" : "next"}
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
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.eyeBtn}
                  hitSlop={10}
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
            <TouchableOpacity style={styles.primaryBtn} onPress={onSubmit}>
              <Text style={styles.primaryBtnText}>
                {isSignUp ? "Create account" : "Sign in"}
              </Text>
            </TouchableOpacity>

            {/* Secondary actions */}
            {!isSignUp && (
              <TouchableOpacity onPress={() => {}} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {isSignUp ? "Already have an account?" : "New here?"}
              </Text>
              <TouchableOpacity
                onPress={() => setMode(isSignUp ? "signin" : "signup")}
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