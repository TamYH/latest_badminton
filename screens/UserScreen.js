import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { auth, db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore'; // Add this import
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import VenueScreen from './VenueScreen';
import UserTeamView from './UserTeamView';
import UserTournamentView from './UserTournamentView';
import TourRegisterScreen from './TourRegisterScreen';

function HomeScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [joinedTournaments, setJoinedTournaments] = useState([]);

  useEffect(() => {
    // Get current user's email and extract username
    if (auth.currentUser && auth.currentUser.email) {
      const email = auth.currentUser.email;
      const extractedUsername = email.split('@')[0];
      setUsername(extractedUsername);
      fetchJoinedTournaments();
    }
  }, []);

  const fetchJoinedTournaments = async () => {
    if (!auth.currentUser) return;

    try {
      const tournamentsRef = collection(db, 'tournaments');
      const snapshot = await getDocs(tournamentsRef);
      
      const joined = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const isJoined = data.approvedRegistrations?.some(
          reg => reg.userId === auth.currentUser.uid
        );
        
        if (isJoined && data.status === 'in-progress') {
          joined.push({ id: doc.id, ...data });
        }
      });
      
      setJoinedTournaments(joined);
    } catch (error) {
      console.error('Error fetching joined tournaments:', error);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.header}>Welcome, {username}!</Text>
        <Text style={styles.subheader}>What would you like to do today?</Text>
      </View>
      
      {/* Add joined tournaments section */}
      {joinedTournaments.length > 0 && (
        <View style={styles.joinedTournamentsSection}>
          <Text style={styles.sectionTitle}>My Active Tournaments</Text>
          {joinedTournaments.slice(0, 2).map(tournament => (
            <TouchableOpacity
              key={tournament.id}
              style={styles.quickTournamentCard}
              onPress={() => navigation.navigate('TournamentView', { tournamentId: tournament.id })}
            >
              <Text style={styles.quickTournamentName}>{tournament.name}</Text>
              <Text style={styles.quickTournamentStatus}>
                {tournament.completed ? 'Completed' : 'In Progress'}
              </Text>
            </TouchableOpacity>
          ))}
          
          {joinedTournaments.length > 2 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Tournament')}
            >
              <Text style={styles.viewAllText}>
                View all {joinedTournaments.length} tournaments
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Teams List</Text>
          <Text style={styles.infoText}>View all teams</Text>
          <Button
            title="View Teams"
            onPress={() => navigation.navigate('Team')}
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

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('TourRegister')}
        >
          <Ionicons name="calendar-outline" size={24} color="#2196F3" />
          <Text style={styles.cardTitle}>Tournament Registration</Text>
          <Text style={styles.cardDescription}>Register for upcoming tournaments</Text>
        </TouchableOpacity>
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
            case 'TourRegister':
              iconName = 'calendar-outline';
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
      <Tab.Screen name="TourRegister" component={TourRegisterScreen} />
      
      <Tab.Screen 
        name="Logout" 
        component={LogoutScreen}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            auth.signOut();
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
  // Add styles for joined tournaments section
  joinedTournamentsSection: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickTournamentCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007aff',
  },
  quickTournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  quickTournamentStatus: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '500',
  },
  viewAllButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    marginLeft: 10,
    color: '#666',
  },
});