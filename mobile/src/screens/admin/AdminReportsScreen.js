import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { generateAdminReportApi, getAdminReportsApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function AdminReportsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    try {
      const result = await getAdminReportsApi({ token: session.token, perPage: 100 });
      setItems(Array.isArray(result?.data) ? result.data : []);
      setError('');
    } catch (apiError) {
      setError(apiError?.error || 'Failed to load reports.');
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const generate = async () => {
    setGenerating(true);
    try {
      await generateAdminReportApi({
        token: session?.token,
        reportType: 'images',
        format: 'csv'
      });
      await load();
      Alert.alert('Report generated', 'A new report has been created.');
    } catch (error) {
      Alert.alert('Generation failed', error?.error || 'Could not generate report.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <Text style={styles.title}>Reports</Text>
      <PrimaryButton title="Generate Images CSV" onPress={generate} loading={generating} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item?.report_id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#16a34a" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No reports found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{String(item?.report_type || '-').toUpperCase()}</Text>
            <Text style={styles.meta}>{String(item?.format || '-').toUpperCase()}</Text>
            <Text style={styles.meta}>{item?.created_at || '-'}</Text>
            <PrimaryButton
              variant="secondary"
              title="Open Link"
              onPress={() => {
                const link = String(item?.download_link || '').trim();
                if (!link) return;
                Linking.openURL(link).catch(() => {
                  Alert.alert('Open failed', 'Could not open report link.');
                });
              }}
            />
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10
  },
  error: {
    color: '#dc2626',
    marginTop: 8
  },
  list: {
    paddingTop: 10,
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
    color: '#0f172a',
    fontWeight: '800'
  },
  meta: {
    color: '#475569'
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20
  }
});
