import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { getAdminImagesApi, getAdminReportsApi, getAdminUsersApi, getRetrainingQueueApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ title, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

export default function AdminDashboardScreen({ navigation }) {
  const { session, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    users: '-',
    images: '-',
    reports: '-',
    pendingQueue: '-'
  });

  const load = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const [users, images, reports, pending] = await Promise.all([
        getAdminUsersApi({ token: session.token, perPage: 1 }),
        getAdminImagesApi({ token: session.token, perPage: 1 }),
        getAdminReportsApi({ token: session.token, perPage: 1 }),
        getRetrainingQueueApi({ token: session.token, status: 'PENDING', perPage: 1 })
      ]);

      setStats({
        users: Number(users?.total || 0),
        images: Number(images?.total || 0),
        reports: Number(reports?.total || 0),
        pendingQueue: Number(pending?.total || 0)
      });
      setError('');
    } catch (apiError) {
      setError(apiError?.error || 'Failed to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Overview and management panels.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Images" value={stats.images} />
        <StatCard title="Reports" value={stats.reports} />
        <StatCard title="Pending Queue" value={stats.pendingQueue} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton title="User Management" onPress={() => navigation.navigate('AdminUsers')} />
        <PrimaryButton variant="secondary" title="Image Management" onPress={() => navigation.navigate('AdminImages')} />
        <PrimaryButton variant="secondary" title="Reports" onPress={() => navigation.navigate('AdminReports')} />
        <PrimaryButton variant="secondary" title="Retraining Queue" onPress={() => navigation.navigate('AdminRetrainingQueue')} />
        <PrimaryButton variant="secondary" title="Logout" onPress={logout} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  loadingText: {
    color: '#334155'
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569',
    marginBottom: 10
  },
  error: {
    color: '#dc2626',
    marginBottom: 10
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12
  },
  statTitle: {
    color: '#64748b',
    fontWeight: '700'
  },
  statValue: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2
  },
  actions: {
    gap: 8
  }
});
