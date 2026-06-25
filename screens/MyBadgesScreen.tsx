import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useAuth } from "../lib/auth-context";
import SafeScreen from "../components/SafeScreen";
import BadgeGrid from "../components/BadgeGrid";

export default function MyBadgesScreen() {
  const { user } = useAuth();

  if (!user) {
    return <SafeScreen />;
  }

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <BadgeGrid userId={user.id} showLocked />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 8,
  },
});
