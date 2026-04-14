import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { getRetrainingQueueApi, updateRetrainingQueueApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

export default function AdminRetrainingQueueScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    try {
      const result = await getRetrainingQueueApi({
        token: session.token,
        status: 'PENDING',
        perPage: 100
      });
      setItems(Array.isArray(result?.items) ? result.items : []);
      setError('');
    } catch (apiError) {
      setError(apiError?.error || 'Failed to load retraining queue.');
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const review = async (queueId, status) => {
    try {
      await updateRetrainingQueueApi({
        token: session?.token,
        queueId,
        status,
        adminId: session?.userId,
        adminNotes: `Reviewed from mobile admin (${status})`
      });
      await load();
    } catch (error) {
      Alert.alert('Update failed', error?.error || 'Could not update queue item.');
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>Retraining Queue</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item?.queue_id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#16a34a" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No pending queue items.</Text>}
        renderItem={({ item }) => {
          const imageUri = resolveBackendAssetUrl(item?.image_path || '');
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
                <View style={styles.info}>
                  <Text style={styles.label}>{item?.label || '-'}</Text>
                  <Text style={styles.meta}>Confidence: {item?.confidence_score || item?.confidence || '-'}</Text>
                  <Text style={styles.meta}>Flagged by: {item?.email || '-'}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <PrimaryButton variant="secondary" title="Approve" onPress={() => review(item?.queue_id, 'APPROVED')} />
                <PrimaryButton variant="secondary" title="Reject" onPress={() => review(item?.queue_id, 'REJECTED')} />
              </View>
            </View>
          );
        }}
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
    gap: 10
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#e2e8f0'
  },
  info: {
    flex: 1
  },
  label: {
    color: '#0f172a',
    fontWeight: '800',
    marginBottom: 4
  },
  meta: {
    color: '#475569',
    marginBottom: 2
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20
  }
});
