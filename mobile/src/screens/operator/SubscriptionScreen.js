import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';

export default function SubscriptionScreen() {
  const openPlan = (plan) => {
    Alert.alert(
      'Not wired yet',
      `${plan} subscription flow requires backend payment APIs (checkout/session/webhook).`
    );
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.subtitle}>
        Choose your plan for higher limits and priority support.
      </Text>

      <View style={styles.card}>
        <Text style={styles.plan}>Free</Text>
        <Text style={styles.feature}>- Basic analysis usage</Text>
        <Text style={styles.feature}>- Standard response speed</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.plan}>Pro</Text>
        <Text style={styles.feature}>- More daily analyses</Text>
        <Text style={styles.feature}>- Faster AI assistant responses</Text>
        <PrimaryButton title="Choose Pro" onPress={() => openPlan('Pro')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.plan}>Enterprise</Text>
        <Text style={styles.feature}>- Team seats</Text>
        <Text style={styles.feature}>- Priority support</Text>
        <PrimaryButton variant="secondary" title="Contact Sales" onPress={() => openPlan('Enterprise')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569',
    marginBottom: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
    gap: 4
  },
  plan: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16
  },
  feature: {
    color: '#334155'
  }
});
