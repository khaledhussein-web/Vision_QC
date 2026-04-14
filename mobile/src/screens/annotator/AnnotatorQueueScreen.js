import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { getAnnotatorQueueApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

const score = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : 'N/A';
};

export default function AnnotatorQueueScreen({ navigation }) {
  const { session, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session?.token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const result = await getAnnotatorQueueApi({
          token: session.token,
          status: 'PENDING',
          perPage: 50
        });
        setItems(Array.isArray(result?.items) ? result.items : []);
        setError('');
      } catch (apiError) {
        setItems([]);
        setError(apiError?.error || 'Failed to load annotation queue.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loading}>Loading annotation queue...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>Annotator Queue</Text>
      <Text style={styles.subtitle}>Pending items for correction workflow.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item?.queue_id || item?.prediction_id || index)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#16a34a" />
        }
        ListEmptyComponent={<Text style={styles.empty}>No pending items.</Text>}
        renderItem={({ item }) => {
          const imageUri = resolveBackendAssetUrl(item?.image_path || item?.image_url || '');
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('AnnotatorImageDetail', { item })}
            >
              <View style={styles.row}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
                <View style={styles.info}>
                  <Text style={styles.label}>{item?.label || 'Unknown'}</Text>
                  <Text style={styles.meta}>Confidence: {score(item?.confidence_score || item?.confidence)}</Text>
                  <Text style={styles.meta}>Reason: {item?.reason || 'No reason'}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
      />

      <Pressable onPress={logout}>
        <Text style={styles.logout}>Logout</Text>
      </Pressable>
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
  loading: {
    color: '#334155'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569',
    marginBottom: 8
  },
  error: {
    color: '#dc2626',
    marginBottom: 10
  },
  list: {
    paddingBottom: 12,
    gap: 10
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12
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
    color: '#334155',
    marginBottom: 2
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20
  },
  logout: {
    textAlign: 'center',
    color: '#166534',
    fontWeight: '700',
    marginTop: 10
  }
});
