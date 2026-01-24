import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth-context';
import RouteList from '../components/RouteList';

export default function HomeScreen({ navigation }: any) {
  const { user, isAdmin, signOut } = useAuth();

  const handleAddRoute = () => {
    if (!user) {
      navigation.navigate('Login', { redirectTo: 'CreateEditRoute' });
    } else {
      navigation.navigate('CreateEditRoute');
    }
  };

  const handleRoutePress = (routeId: string) => {
    navigation.navigate('RouteDetail', { routeId });
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🧗 Up App</Text>
        <View style={styles.headerButtons}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => navigation.navigate('AdminPhotos')}
            >
              <Text style={styles.adminText}>Admin</Text>
            </TouchableOpacity>
          )}
          {user ? (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Text style={styles.subtitle}>Spray Wall Routes</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddRoute}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <RouteList onRoutePress={handleRoutePress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  adminButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6c757d',
    borderRadius: 6,
  },
  adminText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0066cc',
    borderRadius: 6,
  },
  loginText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#dc3545',
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
});
