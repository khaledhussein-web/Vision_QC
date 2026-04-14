import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';

export default function AdminPlaceholderScreen() {
  const { logout } = useAuth();

  return (
    <ScreenContainer>
      <View style={styles.card}>
        <Text style={styles.title}>Admin Mobile Placeholder</Text>
        <Text style={styles.text}>
          Admin mobile screens are prepared but not implemented in this phase.
        </Text>
        <PrimaryButton title="Logout" onPress={logout} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a'
  },
  text: {
    color: '#475569',
    lineHeight: 20
  }
});
