import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteWithStats } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';
import { formatDate } from '../utils/date';

interface RouteCardProps {
  route: RouteWithStats;
  onPress: () => void;
}

export default function RouteCard({ route, onPress }: RouteCardProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={onPress}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{route.title}</Text>
        <View style={styles.headerRight}>
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
      <Text style={[styles.date, { color: colors.textTertiary }]}>
        {formatDate(route.created_at)}
      </Text>
    </TouchableOpacity>
  );
}

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
  date: {
    fontSize: 12,
  },
});
