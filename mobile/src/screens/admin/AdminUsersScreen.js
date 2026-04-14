import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { deleteAdminUserApi, getAdminUsersApi, updateAdminUserApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsersScreen() {
  const { session } = useAuth();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    try {
      const result = await getAdminUsersApi({ token: session.token, perPage: 100 });
      setUsers(Array.isArray(result?.data) ? result.data : []);
      setError('');
    } catch (apiError) {
      setError(apiError?.error || 'Failed to load users.');
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleStatus = async (user) => {
    const nextStatus = String(user?.status || '').toUpperCase() === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateAdminUserApi({
        token: session?.token,
        userId: user?.user_id,
        payload: { status: nextStatus }
      });
      await load();
    } catch (error) {
      Alert.alert('Update failed', error?.error || 'Could not update user status.');
    }
  };

  const removeUser = async (user) => {
    Alert.alert(
      'Delete user',
      `Delete ${user?.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminUserApi({ token: session?.token, userId: user?.user_id });
              await load();
            } catch (error) {
              Alert.alert('Delete failed', error?.error || 'Could not delete user.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>User Management</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={users}
        keyExtractor={(item) => String(item?.user_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#16a34a" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item?.full_name || '-'}</Text>
            <Text style={styles.meta}>{item?.email || '-'}</Text>
            <Text style={styles.meta}>
              {String(item?.role || '-').toUpperCase()} | {String(item?.status || '-').toUpperCase()}
            </Text>

            <View style={styles.actions}>
              <PrimaryButton
                variant="secondary"
                title={String(item?.status || '').toUpperCase() === 'ACTIVE' ? 'Suspend' : 'Activate'}
                onPress={() => toggleStatus(item)}
              />
              <PrimaryButton variant="secondary" title="Delete" onPress={() => removeUser(item)} />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8
  },
  error: {
    color: '#dc2626',
    marginBottom: 8
  },
  list: {
    paddingBottom: 16,
    gap: 10
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  name: {
    fontWeight: '800',
    color: '#0f172a'
  },
  meta: {
    color: '#475569'
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20
  }
});
