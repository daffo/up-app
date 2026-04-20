import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth-context";
import UserBookmarksList from "../components/UserBookmarksList";
import SafeScreen from "../components/SafeScreen";

export default function MySavedScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return <SafeScreen />;
  }

  return (
    <SafeScreen>
      <UserBookmarksList userId={user.id} emptyMessage={t("bookmark.empty")} />
    </SafeScreen>
  );
}
