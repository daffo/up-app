import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // Test Supabase connection
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('routes').select('count').limit(1);
        setIsConnected(!error);
      } catch (err) {
        setIsConnected(false);
      }
    };

    testConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧗 Up App</Text>
      <Text style={styles.subtitle}>Climbing Gym Route Tracker</Text>

      {isConnected === null ? (
        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
      ) : isConnected ? (
        <Text style={styles.status}>✅ Connected to Supabase</Text>
      ) : (
        <Text style={styles.status}>❌ Not connected - Check .env file</Text>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
  status: {
    fontSize: 16,
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
});
