import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { submitAnnotatorCorrectionApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { resolveBackendAssetUrl } from '../../constants/config';

export default function AnnotatorImageDetailScreen({ route }) {
  const { session } = useAuth();
  const item = route.params?.item || {};
  const [correctedLabel, setCorrectedLabel] = useState(String(item?.label || ''));
  const [annotationNotes, setAnnotationNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const imageUri = resolveBackendAssetUrl(item?.image_path || item?.image_url || '');
  const queueId = Number(item?.queue_id || 0);
  const predictionId = Number(item?.prediction_id || 0);

  const submit = async () => {
    if (!predictionId) {
      Alert.alert('Missing prediction', 'Cannot submit without prediction ID.');
      return;
    }

    if (!correctedLabel.trim()) {
      Alert.alert('Missing correction', 'Please provide corrected label.');
      return;
    }

    setLoading(true);
    try {
      const result = await submitAnnotatorCorrectionApi({
        token: session?.token,
        queueId: queueId || null,
        predictionId,
        correctedLabel: correctedLabel.trim(),
        annotationNotes: annotationNotes.trim()
      });
      Alert.alert('Submitted', result?.message || 'Correction saved.');
    } catch (error) {
      Alert.alert('Submission failed', error?.error || 'Could not submit correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Image Detail</Text>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Model label</Text>
        <Text style={styles.value}>{item?.label || 'Unknown'}</Text>

        <Text style={styles.label}>Confidence</Text>
        <Text style={styles.value}>{item?.confidence_score || item?.confidence || 'N/A'}</Text>

        <Text style={styles.label}>Corrected label</Text>
        <TextInput
          value={correctedLabel}
          onChangeText={setCorrectedLabel}
          style={styles.input}
          placeholder="Correct disease label"
        />

        <Text style={styles.label}>Annotation notes</Text>
        <TextInput
          value={annotationNotes}
          onChangeText={setAnnotationNotes}
          style={[styles.input, styles.multiInput]}
          placeholder="Explain why correction is needed"
          multiline
        />

        <PrimaryButton title="Submit Correction" onPress={submit} loading={loading} />
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
    height: 220,
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
  multiInput: {
    minHeight: 90,
    textAlignVertical: 'top'
  }
});
