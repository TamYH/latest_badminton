import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ApprovalsProvider } from './context/ApprovalsContext';
import { auth, db } from './firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import AdminScreen from './screens/AdminScreen';
import UserScreen from './screens/UserScreen';
import VenueScreen from './screens/VenueScreen';
import RollerWheel from './screens/RollerWheel';
import TeamScreen from './screens/TeamScreen';
import TournamentView from './screens/TournamentView';
import UserTeamView from './screens/UserTeamView';
import UserTournamentView from './screens/UserTournamentView';
import EliminationScreen from './screens/EliminationScreen';
import CreateTourScreen from './screens/CreateTourScreen';
import TourRegisterScreen from './screens/TourRegisterScreen';

const Stack = createStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Check if user is admin - using the email format from your Firebase screenshots
        try {
          // Based on your Firebase screenshot, the user document ID is the email with underscores
          const sanitizedEmail = user.email.replace(/[@.]/g, '_');
          const userRef = doc(db, 'users', sanitizedEmail);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('User data:', userData); // Debug log
            if (userData.role === 'admin') {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } else {
            console.log('User document not found');
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      
      if (initializing) {
        setInitializing(false);
      }
    });
    
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ApprovalsProvider>
      <NavigationContainer>
        <Stack.Navigator 
          screenOptions={{ headerShown: false }}
        >
          {!user ? (
            // Authentication screens - only available when user is not logged in
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ headerShown: true, title: 'Register' }}
              />
            </>
          ) : (
            // Authenticated screens - only available when user is logged in
            <>
              {isAdmin ? (
                <Stack.Screen name="AdminScreen" component={AdminScreen} />
              ) : (
                <Stack.Screen name="UserScreen" component={UserScreen} />
              )}
              
              {/* Common screens */}
              <Stack.Screen name="VenueScreen" component={VenueScreen} />
              <Stack.Screen name="RollerWheel" component={RollerWheel} />
              <Stack.Screen name="TeamScreen" component={TeamScreen} />
              <Stack.Screen name="EliminationScreen" component={EliminationScreen} />
              <Stack.Screen name="CreateTourScreen" component={CreateTourScreen} />
              <Stack.Screen name="TournamentView" component={TournamentView} />
              <Stack.Screen name="UserTeamView" component={UserTeamView} />
              <Stack.Screen name="UserTournamentView" component={UserTournamentView} />
              <Stack.Screen name="TourRegister" component={TourRegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ApprovalsProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
  },
});