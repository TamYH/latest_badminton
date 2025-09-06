import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { auth, db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  getCountFromServer,
  orderBy,
  limit
} from 'firebase/firestore';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TeamScreen from './TeamScreen';
import VenueScreen from './VenueScreen';
import RollerWheel from './RollerWheel';

function StatisticsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    teams: 0,
    venues: 0,
    tournaments: 0,
    completedTournaments: 0,
    totalMatches: 0,
    recentTournaments: [],
    topTeams: [],
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      
      // Get user count
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'user'));
      const usersSnapshot = await getCountFromServer(usersQuery);
      const userCount = usersSnapshot.data().count;
      
      // Get team count
      const teamsQuery = query(collection(db, 'teams'));
      const teamsSnapshot = await getCountFromServer(teamsQuery);
      const teamCount = teamsSnapshot.data().count;
      
      // Get venue count
      const venuesQuery = query(collection(db, 'venues'));
      const venuesSnapshot = await getCountFromServer(venuesQuery);
      const venueCount = venuesSnapshot.data().count;
      
      // Get tournament statistics
      const tournamentsQuery = query(collection(db, 'tournaments'));
      const tournamentsSnapshot = await getDocs(tournamentsQuery);
      const tournamentCount = tournamentsSnapshot.size;
      
      // Process tournament data for more stats
      let completedTournaments = 0;
      let totalMatches = 0;
      
      tournamentsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.completed) completedTournaments++;
        if (data.matchups) totalMatches += data.matchups.length;
      });
      
      // Get recent tournaments (last 5)
      const recentTournamentsQuery = query(
        collection(db, 'tournaments'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentTournamentsSnapshot = await getDocs(recentTournamentsQuery);
      const recentTournaments = recentTournamentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || `Tournament ${doc.id}`,
          createdAt: data.createdAt?.toDate() || new Date(),
          completed: data.completed || false,
          matchCount: data.matchups?.length || 0
        };
      });

      // Calculate top teams (most wins)
      const teamWins = {};
      tournamentsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.matchups) {
          data.matchups.forEach(matchup => {
            if (matchup.completed && matchup.winner) {
              const winnerName = matchup.winner === matchup.team1Id ? matchup.team1Name : matchup.team2Name;
              if (!teamWins[winnerName]) teamWins[winnerName] = 0;
              teamWins[winnerName]++;
            }
          });
        }
      });
      
      // Sort teams by wins and get top 5
      const topTeams = Object.entries(teamWins)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, wins]) => ({ name, wins }));

      // Update state with all statistics
      setStats({
        users: userCount,
        teams: teamCount,
        venues: venueCount,
        tournaments: tournamentCount,
        completedTournaments,
        totalMatches,
        recentTournaments,
        topTeams,
      });
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Display a loading indicator while fetching data
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </SafeAreaView>
    );
  }

  // Render the statistics dashboard
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Admin Dashboard</Text>
      
      <ScrollView style={styles.scrollView}>
        {/* Summary Cards */}
        <View style={styles.cardsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.users}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.teams}</Text>
            <Text style={styles.statLabel}>Teams</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.venues}</Text>
            <Text style={styles.statLabel}>Venues</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.tournaments}</Text>
            <Text style={styles.statLabel}>Tournaments</Text>
          </View>
        </View>
        
        {/* Tournament Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Tournament Stats</Text>
          <View style={styles.sectionContent}>
            <View style={styles.statRow}>
              <Text style={styles.statTitle}>Completed Tournaments:</Text>
              <Text style={styles.statInfo}>{stats.completedTournaments}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statTitle}>Total Matches:</Text>
              <Text style={styles.statInfo}>{stats.totalMatches}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statTitle}>Completion Rate:</Text>
              <Text style={styles.statInfo}>
                {stats.tournaments > 0 
                  ? `${Math.round((stats.completedTournaments / stats.tournaments) * 100)}%` 
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Recent Tournaments */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Recent Tournaments</Text>
          {stats.recentTournaments.length > 0 ? (
            <View style={styles.sectionContent}>
              {stats.recentTournaments.map((tournament, index) => (
                <TouchableOpacity 
                  key={tournament.id}
                  style={styles.tournamentItem}
                  onPress={() => navigation.navigate('TournamentView', { tournamentId: tournament.id })}
                >
                  <Text style={styles.tournamentName}>{tournament.name}</Text>
                  <View style={styles.tournamentDetails}>
                    <Text style={styles.tournamentDate}>
                      {tournament.createdAt.toLocaleDateString()}
                    </Text>
                    <Text style={[
                      styles.tournamentStatus,
                      {color: tournament.completed ? '#28a745' : '#007bff'}
                    ]}>
                      {tournament.completed ? 'Completed' : 'In Progress'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No recent tournaments</Text>
          )}
        </View>
        
        {/* Top Teams */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Top Teams (by Wins)</Text>
          {stats.topTeams.length > 0 ? (
            <View style={styles.sectionContent}>
              {stats.topTeams.map((team, index) => (
                <View key={index} style={styles.teamItem}>
                  <Text style={styles.teamRank}>{index + 1}</Text>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamWins}>{team.wins} {team.wins === 1 ? 'win' : 'wins'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No team statistics available</Text>
          )}
        </View>
      </ScrollView>
      
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={fetchStatistics}
      >
        <Ionicons name="refresh-outline" size={24} color="white" />
        <Text style={styles.refreshText}>Refresh Stats</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function LogoutScreen() {
  return null;
}

const Tab = createBottomTabNavigator();

export default function AdminScreen({ navigation }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Statistics':
              iconName = 'stats-chart-outline';
              break;
            case 'Team':
              iconName = 'people-outline';
              break;
            case 'Venues':
              iconName = 'location-outline';
              break;
            case 'RollerWheel':
              iconName = 'cog-outline';
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
      <Tab.Screen name="Statistics" component={StatisticsScreen} />
      <Tab.Screen name="Team" component={TeamScreen} />
      <Tab.Screen name="Venues" component={VenueScreen} />
      <Tab.Screen name="RollerWheel" component={RollerWheel} />
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
    paddingHorizontal: 16, 
    paddingTop: 16, 
    backgroundColor: '#f5f5f5' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333'
  },
  header: { 
    fontSize: 28, 
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333'
  },
  scrollView: {
    flex: 1
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 8
  },
  statLabel: {
    fontSize: 16,
    color: '#6c757d'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#343a40'
  },
  sectionContent: {
    marginBottom: 8
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  statTitle: {
    fontSize: 16,
    color: '#495057'
  },
  statInfo: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007aff'
  },
  tournamentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 4
  },
  tournamentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  tournamentDate: {
    fontSize: 14,
    color: '#6c757d'
  },
  tournamentStatus: {
    fontSize: 14,
    fontWeight: '500'
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  teamRank: {
    width: 30,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007aff'
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    color: '#212529'
  },
  teamWins: {
    fontSize: 16,
    fontWeight: '500',
    color: '#28a745'
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginVertical: 16
  },
  refreshButton: {
    backgroundColor: '#007aff',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  refreshText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8
  }
});