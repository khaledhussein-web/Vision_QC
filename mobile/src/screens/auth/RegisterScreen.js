import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !passwordConfirm) {
      Alert.alert('Missing fields', 'Please complete all fields.');
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert('Password mismatch', 'Password and confirmation must match.');
      return;
    }

    setLoading(true);
    try {
      await register({ fullName, email, password, passwordConfirm });
    } catch (error) {
      Alert.alert('Registration failed', error?.error || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start with the operator workflow.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            style={styles.input}
            placeholder="Your full name"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholder="you@example.com"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            placeholder="At least 8 chars with letters and numbers"
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            style={styles.input}
            placeholder="Re-enter password"
          />

          <PrimaryButton title="Register" loading={loading} onPress={handleRegister} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 16
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569'
  },
  form: {
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
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
  }
});
