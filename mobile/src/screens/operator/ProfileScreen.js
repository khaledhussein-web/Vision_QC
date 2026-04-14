import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { session, logout } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your current mobile session information.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{session?.email || '-'}</Text>

        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{String(session?.role || '-').toUpperCase()}</Text>

        <Text style={styles.label}>User ID</Text>
        <Text style={styles.value}>{session?.userId || '-'}</Text>
      </View>

      <Text style={styles.note}>
        Profile update endpoint is not available in the current backend. This screen shows current account context.
      </Text>

      <PrimaryButton variant="secondary" title="Logout" onPress={logout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569',
    marginBottom: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 12
  },
  label: {
    color: '#64748b',
    fontWeight: '700',
    marginTop: 4
  },
  value: {
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 6
  },
  note: {
    color: '#334155',
    marginBottom: 12
  }
});
