import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert('Login failed', error?.error || 'Invalid credentials or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.wrap}>
        <Text style={styles.title}>VisionQC Mobile</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.form}>
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
            placeholder="********"
          />

          <PrimaryButton title="Login" onPress={handleLogin} loading={loading} />
          <View style={styles.linksRow}>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>Create account</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('ForgotPassword', { email: String(email || '').trim() })}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 18
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 16,
    color: '#334155'
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
    backgroundColor: '#ffffff',
    marginBottom: 4
  },
  linksRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  link: {
    color: '#166534',
    fontWeight: '700'
  }
});
