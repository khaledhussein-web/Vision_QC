import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { flagForRetrainingApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

export default function AdminImageDetailScreen({ route }) {
  const { session } = useAuth();
  const item = route.params?.item || {};
  const [reason, setReason] = useState('Needs manual review');
  const [loading, setLoading] = useState(false);

  const imageUri = resolveBackendAssetUrl(item?.image_url || '');

  const queueForRetraining = async () => {
    const predictionId = Number(item?.prediction_id || 0);
    if (!predictionId) {
      Alert.alert('Unavailable', 'Prediction is missing for this image.');
      return;
    }

    setLoading(true);
    try {
      const result = await flagForRetrainingApi({
        token: session?.token,
        predictionId,
        userId: item?.user_id || session?.userId,
        reason
      });
      Alert.alert('Queued', result?.message || 'Added to retraining queue.');
    } catch (error) {
      Alert.alert('Queue failed', error?.error || 'Could not flag this prediction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Image Detail</Text>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Owner</Text>
        <Text style={styles.value}>{item?.email || '-'}</Text>

        <Text style={styles.label}>Label</Text>
        <Text style={styles.value}>{item?.label || '-'}</Text>

        <Text style={styles.label}>Confidence</Text>
        <Text style={styles.value}>{item?.confidence || '-'}</Text>

        <Text style={styles.label}>Reason for retraining</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          style={[styles.input, styles.multi]}
          multiline
        />

        <PrimaryButton title="Flag for Retraining" onPress={queueForRetraining} loading={loading} />
      </View>
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
  image: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    marginBottom: 10
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  label: {
    color: '#64748b',
    fontWeight: '700'
  },
  value: {
    color: '#0f172a',
    fontWeight: '700'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  multi: {
    minHeight: 90,
    textAlignVertical: 'top'
  }
});
