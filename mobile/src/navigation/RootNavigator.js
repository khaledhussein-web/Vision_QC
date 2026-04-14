import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import OperatorHomeScreen from '../screens/operator/OperatorHomeScreen';
import CaptureUploadScreen from '../screens/operator/CaptureUploadScreen';
import PredictionResultScreen from '../screens/operator/PredictionResultScreen';
import HistoryScreen from '../screens/operator/HistoryScreen';
import AIChatScreen from '../screens/operator/AIChatScreen';
import BookmarksScreen from '../screens/operator/BookmarksScreen';
import ProfileScreen from '../screens/operator/ProfileScreen';
import SubscriptionScreen from '../screens/operator/SubscriptionScreen';
import AnnotatorQueueScreen from '../screens/annotator/AnnotatorQueueScreen';
import AnnotatorImageDetailScreen from '../screens/annotator/AnnotatorImageDetailScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminImagesScreen from '../screens/admin/AdminImagesScreen';
import AdminImageDetailScreen from '../screens/admin/AdminImageDetailScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminRetrainingQueueScreen from '../screens/admin/AdminRetrainingQueueScreen';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={styles.loadingWrap}>
    <ActivityIndicator size="large" color="#16a34a" />
    <Text style={styles.loadingText}>Loading session...</Text>
  </View>
);

const AuthStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
  </Stack.Navigator>
);

const OperatorStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="OperatorHome"
      component={OperatorHomeScreen}
      options={{ title: 'Home' }}
    />
    <Stack.Screen name="CaptureUpload" component={CaptureUploadScreen} options={{ title: 'Capture / Upload' }} />
    <Stack.Screen name="PredictionResult" component={PredictionResultScreen} options={{ title: 'Prediction Result' }} />
    <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
    <Stack.Screen name="AIChat" component={AIChatScreen} options={{ title: 'AI Chat' }} />
    <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Bookmarks' }} />
    <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
  </Stack.Navigator>
);

const AnnotatorStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="AnnotatorQueue" component={AnnotatorQueueScreen} options={{ title: 'Queue' }} />
    <Stack.Screen
      name="AnnotatorImageDetail"
      component={AnnotatorImageDetailScreen}
      options={{ title: 'Image Detail' }}
    />
  </Stack.Navigator>
);

const AdminStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard' }} />
    <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'User Management' }} />
    <Stack.Screen name="AdminImages" component={AdminImagesScreen} options={{ title: 'Image Management' }} />
    <Stack.Screen
      name="AdminImageDetail"
      component={AdminImageDetailScreen}
      options={{ title: 'Image Detail' }}
    />
    <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: 'Reports' }} />
    <Stack.Screen
      name="AdminRetrainingQueue"
      component={AdminRetrainingQueueScreen}
      options={{ title: 'Retraining Queue' }}
    />
  </Stack.Navigator>
);

export default function RootNavigator() {
  const { loading, isAuthenticated, session } = useAuth();

  return (
    <NavigationContainer>
      {loading ? (
        <LoadingScreen />
      ) : !isAuthenticated ? (
        <AuthStack />
      ) : session?.role === 'admin' ? (
        <AdminStack />
      ) : session?.role === 'annotator' ? (
        <AnnotatorStack />
      ) : (
        <OperatorStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc'
  },
  loadingText: {
    color: '#334155'
  }
});
