import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteWithStats } from '../lib/api';
import { formatDate } from '../utils/date';

interface RouteCardProps {
  route: RouteWithStats;
  onPress: () => void;
}

export default function RouteCard({ route, onPress }: RouteCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{route.title}</Text>
        <View style={styles.headerRight}>
          {route.avgRating !== null && (
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color="#f5a623" />
              <Text style={styles.ratingText}>{route.avgRating.toFixed(1)}</Text>
            </View>
          )}
          <Text style={styles.grade}>{route.grade}</Text>
        </View>
      </View>
      {route.description && (
        <Text style={styles.description} numberOfLines={2}>
          {route.description}
        </Text>
      )}
      <Text style={styles.date}>
        {formatDate(route.created_at)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
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
    color: '#f5a623',
  },
  grade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
});
