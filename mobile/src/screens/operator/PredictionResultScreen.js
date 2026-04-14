import React, { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { flagForRetrainingApi, toggleBookmarkApi } from '../../api/client';
import { resolveBackendAssetUrl } from '../../constants/config';
import { useAuth } from '../../context/AuthContext';

const formatConfidence = (confidence) => {
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed)) return 'N/A';
  return `${Math.round(parsed * 100)}%`;
};

export default function PredictionResultScreen({ navigation, route }) {
  const { session } = useAuth();
  const prediction = route.params?.prediction || {};
  const [bookmarked, setBookmarked] = useState(Boolean(prediction?.bookmark_id));
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [flagLoading, setFlagLoading] = useState(false);
  const localImageUri = String(route.params?.imageUri || '').trim();
  const remoteImageUri = resolveBackendAssetUrl(prediction?.image_url || '');
  const displayUri = localImageUri || remoteImageUri;
  const predictionId = useMemo(() => Number(prediction?.prediction_id || 0), [prediction?.prediction_id]);

  const handleBookmarkToggle = async () => {
    if (!predictionId) {
      Alert.alert('Unavailable', 'Prediction ID is missing for bookmark.');
      return;
    }

    setBookmarkLoading(true);
    try {
      const nextAction = bookmarked ? 'remove' : 'add';
      await toggleBookmarkApi({
        token: session?.token,
        predictionId,
        userId: session?.userId,
        action: nextAction
      });
      setBookmarked(!bookmarked);
    } catch (error) {
      Alert.alert('Bookmark failed', error?.error || 'Please try again.');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleFlagForRetraining = async () => {
    if (!predictionId) {
      Alert.alert('Unavailable', 'Prediction ID is missing.');
      return;
    }

    setFlagLoading(true);
    try {
      const result = await flagForRetrainingApi({
        token: session?.token,
        predictionId,
        userId: session?.userId,
        reason: 'Flagged from mobile prediction result'
      });
      Alert.alert('Submitted', result?.message || 'Flagged for retraining queue.');
    } catch (error) {
      Alert.alert(
        'Flag failed',
        error?.error || 'Could not flag prediction. It may already be above confidence threshold.'
      );
    } finally {
      setFlagLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Prediction Result</Text>

      {displayUri ? <Image source={{ uri: displayUri }} style={styles.image} /> : null}

      <View style={styles.resultCard}>
        <Text style={styles.label}>Disease / Condition</Text>
        <Text style={styles.value}>{prediction?.label || 'Unknown'}</Text>

        <Text style={styles.label}>Confidence</Text>
        <Text style={styles.value}>{formatConfidence(prediction?.confidence)}</Text>

        <Text style={styles.label}>Suggested Treatment</Text>
        <Text style={styles.description}>{prediction?.suggested_sc || 'No suggestion available.'}</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          title="Analyze Another Image"
          onPress={() => navigation.navigate('CaptureUpload')}
        />
        <PrimaryButton
          variant="secondary"
          title={bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
          onPress={handleBookmarkToggle}
          loading={bookmarkLoading}
        />
        <PrimaryButton
          variant="secondary"
          title="Ask AI About This Result"
          onPress={() =>
            navigation.navigate('AIChat', {
              predictionId
            })
          }
        />
        <PrimaryButton
          variant="secondary"
          title="Flag for Retraining"
          onPress={handleFlagForRetraining}
          loading={flagLoading}
        />
        <PrimaryButton
          variant="secondary"
          title="View History"
          onPress={() => navigation.navigate('History')}
        />
        <PrimaryButton
          variant="secondary"
          title="Back to Home"
          onPress={() => navigation.navigate('OperatorHome')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 12
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14
  },
  label: {
    color: '#64748b',
    fontWeight: '700',
    marginTop: 4
  },
  value: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6
  },
  description: {
    color: '#334155',
    lineHeight: 20
  },
  actions: {
    gap: 10
  }
});
