import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Database } from '../types/database.types';
import { formatDate } from '../utils/date';

type Route = Database['public']['Tables']['routes']['Row'];

interface RouteCardProps {
  route: Route;
  onPress: () => void;
}

export default function RouteCard({ route, onPress }: RouteCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{route.title}</Text>
        <Text style={styles.grade}>{route.grade}</Text>
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
  grade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066cc',
    marginLeft: 12,
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
