import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { resetPasswordApi, validateResetTokenApi } from '../../api/client';

export default function ResetPasswordScreen({ navigation, route }) {
  const [token, setToken] = useState(String(route.params?.token || ''));
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState('');

  useEffect(() => {
    const incomingToken = String(route.params?.token || '').trim();
    if (incomingToken) {
      setToken(incomingToken);
    }
  }, [route.params?.token]);

  const validateToken = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      Alert.alert('Missing token', 'Enter the reset token first.');
      return;
    }

    setValidating(true);
    try {
      const result = await validateResetTokenApi(trimmed);
      setTokenStatus(result?.message || 'Reset token is valid.');
    } catch (error) {
      setTokenStatus(error?.error || 'Invalid or expired reset token.');
    } finally {
      setValidating(false);
    }
  };

  const handleReset = async () => {
    if (!token.trim() || !password || !passwordConfirmation) {
      Alert.alert('Missing fields', 'Please fill token, password, and confirmation.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordApi({
        token: token.trim(),
        password,
        passwordConfirmation
      });
      Alert.alert(
        'Password reset',
        result?.message || 'Password reset successful.',
        [{ text: 'Back to login', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Reset failed', error?.error || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Paste your token and set a new password.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Reset token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          style={styles.input}
          placeholder="Paste token from email link"
        />
        <PrimaryButton
          variant="secondary"
          title="Validate token"
          onPress={validateToken}
          loading={validating}
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="At least 8 chars with letters and numbers"
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          value={passwordConfirmation}
          onChangeText={setPasswordConfirmation}
          secureTextEntry
          style={styles.input}
          placeholder="Re-enter new password"
        />

        <PrimaryButton title="Reset password" onPress={handleReset} loading={loading} />
      </View>

      {tokenStatus ? <Text style={styles.status}>{tokenStatus}</Text> : null}
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
  status: {
    marginTop: 12,
    color: '#166534',
    fontWeight: '600'
  }
});
