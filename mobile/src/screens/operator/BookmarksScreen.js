import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { getHistoryApi, toggleBookmarkApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

const formatConfidence = (confidence) => {
  const value = Number(confidence);
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'N/A';
};

export default function BookmarksScreen({ navigation }) {
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
        const result = await getHistoryApi({
          token: session.token,
          userId: session.userId
        });
        const rawItems = Array.isArray(result?.data) ? result.data : [];
        setItems(rawItems.filter((item) => Boolean(item?.bookmark_id)));
        setError('');
      } catch (apiError) {
        setError(apiError?.error || 'Failed to load bookmarks.');
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

  const unbookmark = async (predictionId) => {
    try {
      await toggleBookmarkApi({
        token: session?.token,
        predictionId,
        userId: session?.userId,
        action: 'remove'
      });
      setItems((prev) => prev.filter((item) => Number(item?.prediction_id) !== Number(predictionId)));
    } catch (_error) {
      // Keep current list if API fails.
    }
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading bookmarks...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>Bookmarks</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item?.prediction_id || `${index}`)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#16a34a" />
        }
        ListEmptyComponent={<Text style={styles.empty}>No bookmarks yet.</Text>}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const imageUri = resolveBackendAssetUrl(item?.image_url || '');
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
                <View style={styles.info}>
                  <Text style={styles.label}>{item?.label || 'Unknown'}</Text>
                  <Text style={styles.meta}>Confidence: {formatConfidence(item?.confidence)}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <PrimaryButton
                  variant="secondary"
                  title="Open"
                  onPress={() =>
                    navigation.navigate('PredictionResult', {
                      prediction: item,
                      imageUri
                    })
                  }
                />
                <PrimaryButton
                  variant="secondary"
                  title="Remove"
                  onPress={() => unbookmark(item?.prediction_id)}
                />
              </View>
            </View>
          );
        }}
      />
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
    gap: 12
  },
  thumb: {
    width: 76,
    height: 76,
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
    color: '#475569'
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30
  }
});
