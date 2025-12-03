import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../lib/auth-context';

export default function HomeScreen({ navigation }: any) {
  const { user, signOut } = useAuth();

  const handleAddRoute = () => {
    if (!user) {
      navigation.navigate('Login');
    } else {
      // TODO: Navigate to add route screen
      alert('Add route screen coming soon!');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🧗 Up App</Text>
        {user ? (
          <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
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

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Spray Wall Routes</Text>

        <Text style={styles.comingSoon}>
          Route list coming soon...
        </Text>

        <TouchableOpacity style={styles.addButton} onPress={handleAddRoute}>
          <Text style={styles.addButtonText}>+ Add Route</Text>
        </TouchableOpacity>
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
    padding: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  comingSoon: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 40,
    marginBottom: 40,
  },
  addButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
