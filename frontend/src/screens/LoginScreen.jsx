// src/screens/LoginScreen.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { loginWithKakao } = useAuth();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setErr("");
    setBusy(true);
    try {
      await loginWithKakao();
    } catch (e) {
      setErr(e.message || "로그인 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>GuildRunner</Text>
      {busy ? (
        <ActivityIndicator size="large" />
      ) : (
        <TouchableOpacity style={styles.kakao} onPress={onPress}>
          <Text style={styles.kakaoText}>카카오로 계속하기</Text>
        </TouchableOpacity>
      )}
      {!!err && <Text style={styles.err}>{err}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: "700" },
  kakao: {
    backgroundColor: "#FEE500",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  kakaoText: { fontWeight: "700" },
  err: { color: "crimson", marginTop: 8, textAlign: "center" },
});
