import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { getAdminImagesApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

export default function AdminImagesScreen({ navigation }) {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    try {
      const result = await getAdminImagesApi({ token: session.token, perPage: 100 });
      setItems(Array.isArray(result?.data) ? result.data : []);
      setError('');
    } catch (apiError) {
      setError(apiError?.error || 'Failed to load images.');
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>Image Management</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item?.prediction_id || item?.image_id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#16a34a" />}
        ListEmptyComponent={<Text style={styles.empty}>No images found.</Text>}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const imageUri = resolveBackendAssetUrl(item?.image_url || '');
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('AdminImageDetail', { item })}
            >
              <View style={styles.row}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.thumb} /> : null}
                <View style={styles.info}>
                  <Text style={styles.label}>{item?.label || 'Unlabeled'}</Text>
                  <Text style={styles.meta}>{item?.email || '-'}</Text>
                  <Text style={styles.meta}>Confidence: {item?.confidence || '-'}</Text>
                </View>
              </View>
            </Pressable>
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
    padding: 12
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  thumb: {
    width: 78,
    height: 78,
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
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20
  }
});
