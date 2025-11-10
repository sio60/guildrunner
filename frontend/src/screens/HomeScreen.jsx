// src/screens/HomeScreen.jsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen() {
  const { profile, jwt, logout } = useAuth();

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>환영!</Text>
      <Text style={styles.p}>토큰: {jwt ? `${jwt.slice(0, 12)}...` : "-"}</Text>
      <Text style={styles.p}>
        닉네임: {profile?.nickname || profile?.name || "-"}
      </Text>
      <Text style={styles.p}>이메일: {profile?.email || "-"}</Text>

      <TouchableOpacity onPress={logout} style={styles.btn}>
        <Text style={styles.btnText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  h1: { fontSize: 22, fontWeight: "700" },
  p: { fontSize: 14, color: "#333" },
  btn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  btnText: { color: "white", fontWeight: "700" },
});
