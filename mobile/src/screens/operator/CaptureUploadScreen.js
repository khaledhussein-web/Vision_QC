import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { analyzeImageApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const normalizeAsset = (pickerAsset) => {
  if (!pickerAsset?.uri) return null;
  return {
    uri: pickerAsset.uri,
    fileName: pickerAsset.fileName || `capture-${Date.now()}.jpg`,
    mimeType: pickerAsset.mimeType || 'image/jpeg'
  };
};

const SUPPORTED_CROP_HINTS = [
  'apple',
  'apricot',
  'bean',
  'cherry',
  'corn',
  'fig',
  'grape',
  'loquat',
  'pear',
  'pepper',
  'persimmon',
  'potato',
  'tomato',
  'walnut'
];

export default function CaptureUploadScreen({ navigation }) {
  const { session } = useAuth();
  const [asset, setAsset] = useState(null);
  const [cropHint, setCropHint] = useState('');
  const [loading, setLoading] = useState(false);
  const previewUri = useMemo(() => String(asset?.uri || ''), [asset]);

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8
    });
    if (!result.canceled) {
      setAsset(normalizeAsset(result.assets?.[0]));
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Media library permission is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8
    });
    if (!result.canceled) {
      setAsset(normalizeAsset(result.assets?.[0]));
    }
  };

  const analyze = async () => {
    if (!asset?.uri) {
      Alert.alert('No image', 'Please capture or choose an image first.');
      return;
    }

    setLoading(true);
    try {
      const prediction = await analyzeImageApi({
        token: session?.token,
        imageAsset: asset,
        cropHint
      });
      navigation.navigate('PredictionResult', {
        prediction,
        imageUri: asset.uri
      });
    } catch (error) {
      Alert.alert('Prediction failed', error?.error || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Capture / Upload</Text>
      <Text style={styles.subtitle}>Take a photo in good light or pick one from your gallery.</Text>

      <View style={styles.card}>
        {previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={styles.preview} />
            <View style={styles.meta}>
              <Text style={styles.label}>Crop / Plant Type (Optional but recommended)</Text>
              <TextInput
                value={cropHint}
                onChangeText={setCropHint}
                placeholder="Select or type crop name (e.g., apple)"
                autoCapitalize="none"
                style={styles.input}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {SUPPORTED_CROP_HINTS.map((crop) => {
                  const selected = cropHint.trim().toLowerCase() === crop;
                  return (
                    <Pressable
                      key={crop}
                      onPress={() => setCropHint(crop)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{crop}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.helpText}>
                Matching crop type improves diagnosis by narrowing disease classes.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyText}>No image selected</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton title="Take Photo" onPress={pickFromCamera} />
        <PrimaryButton variant="secondary" title="Choose from Gallery" onPress={pickFromLibrary} />
        <PrimaryButton title="Run Prediction" onPress={analyze} loading={loading} disabled={!asset} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6
  },
  subtitle: {
    color: '#475569',
    marginBottom: 14
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginBottom: 16
  },
  preview: {
    width: '100%',
    height: 260
  },
  meta: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8
  },
  label: {
    color: '#0f172a',
    fontWeight: '700'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: '#0f172a'
  },
  chips: {
    gap: 8,
    paddingVertical: 2
  },
  chip: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  chipSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a'
  },
  chipText: {
    color: '#166534',
    fontWeight: '600'
  },
  chipTextSelected: {
    color: '#ffffff'
  },
  helpText: {
    color: '#64748b',
    fontSize: 12
  },
  emptyPreview: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9'
  },
  emptyText: {
    color: '#64748b'
  },
  actions: {
    gap: 10
  }
});
