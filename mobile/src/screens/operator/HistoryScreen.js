import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { getHistoryApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

const formatDate = (isoDate) => {
  const value = String(isoDate || '').trim();
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatConfidence = (confidence) => {
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed)) return 'N/A';
  return `${Math.round(parsed * 100)}%`;
};

export default function HistoryScreen({ navigation }) {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session?.token || !session?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getHistoryApi({
          token: session.token,
          userId: session.userId
        });
        setItems(Array.isArray(data?.data) ? data.data : []);
        setError('');
      } catch (apiError) {
        setError(apiError?.error || 'Failed to load history.');
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

  const renderItem = ({ item }) => {
    const imageUri = resolveBackendAssetUrl(item?.image_url || '');
    return (
      <Pressable
        onPress={() =>
          navigation.navigate('PredictionResult', {
            prediction: item,
            imageUri
          })
        }
        style={styles.card}
      >
        <View style={styles.row}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
          <View style={styles.info}>
            <Text style={styles.label}>{item?.label || 'Unknown'}</Text>
            <Text style={styles.meta}>Confidence: {formatConfidence(item?.confidence)}</Text>
            <Text style={styles.meta}>Created: {formatDate(item?.created_at)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>History</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          String(item?.prediction_id || `${item?.image_id || 'img'}-${item?.created_at || 'na'}-${index}`)
        }
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No analysis history yet.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#16a34a" />
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  loadingText: {
    color: '#334155'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10
  },
  error: {
    color: '#dc2626',
    marginBottom: 10
  },
  listContent: {
    paddingBottom: 20
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 10
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e2e8f0'
  },
  info: {
    flex: 1
  },
  label: {
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4
  },
  meta: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 2
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30
  }
});
