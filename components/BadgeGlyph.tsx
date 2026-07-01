import React from "react";
import { Text } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BadgeIconSet } from "../lib/badges";

interface BadgeGlyphProps {
  iconSet: BadgeIconSet;
  icon: string;
  color: string;
  size?: number;
}

export default function BadgeGlyph({
  iconSet,
  icon,
  color,
  size = 24,
}: BadgeGlyphProps) {
  if (iconSet === "emoji") {
    return <Text style={{ fontSize: size }}>{icon}</Text>;
  }
  if (iconSet === "ionicons") {
    return <Ionicons name={icon as any} size={size} color={color} />;
  }
  return (
    <MaterialCommunityIcons name={icon as any} size={size} color={color} />
  );
}
