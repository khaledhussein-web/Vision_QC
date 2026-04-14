import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { forgotPasswordApi } from '../../api/client';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [resetToken, setResetToken] = useState('');

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPasswordApi(email.trim());
      setFeedback(
        result?.message || 'If the email is registered, a password reset link has been sent.'
      );
      const token = String(result?.reset_token || '').trim();
      setResetToken(token);
      if (token) {
        navigation.navigate('ResetPassword', { token });
      }
    } catch (error) {
      setFeedback('');
      setResetToken('');
      Alert.alert('Request failed', error?.error || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.subtitle}>
        Enter your account email to receive a reset link.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="you@example.com"
        />
        <PrimaryButton title="Send reset link" loading={loading} onPress={handleSend} />
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      {resetToken ? (
        <Text style={styles.tokenHint}>
          Dev token detected. Continue in reset screen with token prefilled.
        </Text>
      ) : null}
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
  subtitle: {
    color: '#475569',
    marginBottom: 12
  },
  card: {
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14
  },
  label: {
    color: '#334155',
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  feedback: {
    marginTop: 12,
    color: '#166534',
    fontWeight: '600'
  },
  tokenHint: {
    marginTop: 8,
    color: '#334155'
  }
});
