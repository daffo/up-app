import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteWithStats } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';
import { formatDate } from '../utils/date';
import { useTranslation } from 'react-i18next';

interface RouteCardProps {
  route: RouteWithStats;
  routeId: string;
  onPress: (routeId: string) => void;
}

function RouteCard({ route, routeId, onPress }: RouteCardProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={() => onPress(routeId)}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{route.title}</Text>
        <View style={styles.headerRight}>
          {route.is_draft && (
            <View style={[styles.draftBadge, { backgroundColor: colors.primaryLightAlt }]}>
              <Text style={[styles.draftBadgeText, { color: colors.warning }]}>{t('route.draft')}</Text>
            </View>
          )}
          {route.avgRating !== null && (
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={colors.star} />
              <Text style={[styles.ratingText, { color: colors.star }]}>{route.avgRating.toFixed(1)}</Text>
            </View>
          )}
          <Text style={[styles.grade, { color: colors.primary }]}>{route.grade}</Text>
        </View>
      </View>
      {route.description && (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {route.description}
        </Text>
      )}
      <View style={styles.footer}>
        <Text style={[styles.date, { color: colors.textTertiary }]}>
          {formatDate(route.created_at)}
        </Text>
        <View style={styles.holdCounts}>
          <Text style={[styles.holdCount, { color: colors.textTertiary }]}>🤚 {route.holds.hand_holds.length}</Text>
          {route.holds.foot_holds.length > 0 && (
            <Text style={[styles.holdCount, { color: colors.textTertiary }]}>🦶 {route.holds.foot_holds.length}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(RouteCard);

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  grade: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
  },
  holdCounts: {
    flexDirection: 'row',
    gap: 8,
  },
  holdCount: {
    fontSize: 12,
  },
  draftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  draftBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
