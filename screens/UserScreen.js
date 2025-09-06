import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, Button, StyleSheet } from 'react-native';
import { auth } from '../firebase/config';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import VenueScreen from './VenueScreen';
import UserTeamView from './UserTeamView';
import UserTournamentView from './UserTournamentView';

function HomeScreen({ navigation }) {
  const [username, setUsername] = useState('');

  useEffect(() => {
    // Get current user's email and extract username
    if (auth.currentUser && auth.currentUser.email) {
      const email = auth.currentUser.email;
      const extractedUsername = email.split('@')[0];
      setUsername(extractedUsername);
    }
  }, []);

  const handleLogout = () => {
    auth.signOut();
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.header}>Welcome, {username}!</Text>
        <Text style={styles.subheader}>What would you like to do today?</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Teams List</Text>
          <Text style={styles.infoText}>View all teams</Text>
          <Button
            title="View Teams"
            onPress={() => navigation.navigate('Team')}//name="Team" component={UserTeamView}
            color="#007aff"
          />
        </View>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Upcoming Tournaments</Text>
          <Text style={styles.infoText}>Check your tournament schedule</Text> 
          <Button
            title="View Tournaments"
            onPress={() => navigation.navigate('Tournament')}  
            color="#007aff"
          />
        </View>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Venues</Text>
          <Text style={styles.infoText}>Find nearby venues</Text>
          <Button
            title="View Venues"
            onPress={() => navigation.navigate('Venue')}
            color="#007aff"
          />
        </View>
      </View>
      
     
    </SafeAreaView>
  );
}

function LogoutScreen() {
  return null; // This screen is just used for the tab icon
}

const Tab = createBottomTabNavigator();

export default function UserTabs({ navigation }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = 'home-outline';
              break;
            case 'Venue':
              iconName = 'location-outline';
              break;
            case 'Team':
              iconName = 'people-outline';
              break;
            case 'Tournament':
              iconName = 'trophy-outline';
              break;
            case 'Logout':
              iconName = 'log-out-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
      tabBarOptions={{
        activeTintColor: '#007aff',
        inactiveTintColor: 'gray',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Venue" component={VenueScreen} />
      <Tab.Screen name="Team" component={UserTeamView} />
      <Tab.Screen name="Tournament" component={UserTournamentView} />
      <Tab.Screen 
        name="Logout" 
        component={LogoutScreen}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            auth.signOut();
            navigation.replace('Login');
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F7f2eb',
    
    
  },
  welcomeContainer: {
    marginTop: 30,
    marginBottom: 30,
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subheader: {
    fontSize: 18,
    color: '#666',
  },
  infoContainer: {
    flex: 1,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 15,
    color: '#666',
  },
});