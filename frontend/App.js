// App.jsx
import React from 'react';
import { SafeAreaView, View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

function Gate() {
  const { loading, jwt } = useAuth();
  if (loading) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
  return jwt ? <HomeScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <Gate />
      </SafeAreaView>
    </AuthProvider>
  );
}
