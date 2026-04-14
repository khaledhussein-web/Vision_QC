import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';

export default function OperatorHomeScreen({ navigation }) {
  const { session, logout } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Operator Dashboard</Text>
      <Text style={styles.subtitle}>Logged in as: {session?.email || 'unknown'}</Text>

      <View style={styles.steps}>
        <Text style={styles.stepTitle}>Flow</Text>
        <Text style={styles.stepLine}>1. Capture or upload plant image</Text>
        <Text style={styles.stepLine}>2. Run prediction and inspect confidence</Text>
        <Text style={styles.stepLine}>3. Ask AI for treatment advice</Text>
        <Text style={styles.stepLine}>4. Save useful cases as bookmarks</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton title="Start Analysis" onPress={() => navigation.navigate('CaptureUpload')} />
        <PrimaryButton variant="secondary" title="History" onPress={() => navigation.navigate('History')} />
        <PrimaryButton variant="secondary" title="AI Chat" onPress={() => navigation.navigate('AIChat')} />
        <PrimaryButton
          variant="secondary"
          title="Bookmarks"
          onPress={() => navigation.navigate('Bookmarks')}
        />
        <PrimaryButton variant="secondary" title="Profile" onPress={() => navigation.navigate('Profile')} />
        <PrimaryButton
          variant="secondary"
          title="Subscription"
          onPress={() => navigation.navigate('Subscription')}
        />
        <PrimaryButton variant="secondary" title="Logout" onPress={logout} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8
  },
  subtitle: {
    color: '#475569',
    marginBottom: 16
  },
  steps: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16
  },
  stepTitle: {
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
    color: '#166534'
  },
  stepLine: {
    color: '#334155',
    marginBottom: 4
  },
  actions: {
    gap: 10
  }
});
