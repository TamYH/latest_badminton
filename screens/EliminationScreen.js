import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, query, serverTimestamp } from 'firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';

const EliminationScreen = ({ navigation }) => {
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get all users from Firestore
      const usersCollection = collection(db, 'users');
      const querySnapshot = await getDocs(usersCollection);
      
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || doc.id,
        name: doc.data().name || doc.data().email || doc.id,
        selected: false
      }));
      
      setUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
      setLoading(false);
    }
  };

  const togglePlayerSelection = (player) => {
    const updatedPlayers = users.map(u => {
      if (u.id === player.id) {
        return { ...u, selected: !u.selected };
      }
      return u;
    });
    
    setUsers(updatedPlayers);
    
    // Update selected players
    const newSelectedPlayers = updatedPlayers.filter(p => p.selected);
    setSelectedPlayers(newSelectedPlayers);
  };

  const createTournament = async () => {
    // Validate input
    if (tournamentName.trim() === '') {
      Alert.alert('Error', 'Please enter a tournament name');
      return;
    }

    if (selectedPlayers.length < 2) {
      Alert.alert('Error', 'Please select at least 2 players');
      return;
    }

    try {
      setSaving(true);
      
      // Create matchups for players (single elimination format)
      let matchups = [];
      const shuffledPlayers = [...selectedPlayers].sort(() => 0.5 - Math.random());
      
      // If odd number of players, one gets a bye in the first round
      const evenPlayers = shuffledPlayers.length % 2 === 0 
        ? shuffledPlayers 
        : [...shuffledPlayers, { id: 'bye', name: 'BYE', email: 'bye' }];
      
      // Create first round matchups
      for (let i = 0; i < evenPlayers.length; i += 2) {
        const player1 = evenPlayers[i];
        const player2 = evenPlayers[i + 1];
        
        // If player2 is a bye, player1 automatically advances
        const completed = player2.id === 'bye';
        const winner = completed ? player1.id : null;
        
        matchups.push({
          round: 1,
          team1Id: player1.id,
          team1Name: player1.name || player1.email,
          team2Id: player2.id,
          team2Name: player2.name || player2.email,
          completed: completed,
          winner: winner,
          matchupTime: ''
        });
      }
      
      // Create the tournament in Firestore
      const tournamentRef = await addDoc(collection(db, 'tournaments'), {
        name: tournamentName,
        type: 'elimination',
        totalPlayers: selectedPlayers.length,
        matchups: matchups,
        currentRound: 1,
        completed: false,
        createdAt: serverTimestamp(),
        players: selectedPlayers.map(p => ({
          id: p.id,
          name: p.name || p.email,
          email: p.email
        }))
      });
      
      setSaving(false);
      Alert.alert(
        'Success',
        'Tournament created successfully!',
        [
          { 
            text: 'View Tournament', 
            onPress: () => navigation.navigate('TournamentView', { tournamentId: tournamentRef.id }) 
          },
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('Error creating tournament:', error);
      Alert.alert('Error', 'Failed to create tournament. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading players...</Text>
      </View>
    );
  }

  if (saving) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Creating tournament...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Individual Elimination Tournament</Text>
          <Text style={styles.subtitle}>
            Create a tournament where individuals compete directly (not teams)
          </Text>
        </View>
        
        <View style={styles.formSection}>
          <Text style={styles.label}>Tournament Name</Text>
          <TextInput
            style={styles.input}
            value={tournamentName}
            onChangeText={setTournamentName}
            placeholder="Enter tournament name"
            placeholderTextColor="#999"
          />
          
          <Text style={styles.label}>Select Players ({selectedPlayers.length} selected)</Text>
          <Text style={styles.infoText}>Tap on players to select them for the tournament</Text>
        </View>
        
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.playerItem, item.selected && styles.selectedPlayer]}
              onPress={() => togglePlayerSelection(item)}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{item.name || item.email}</Text>
                <Text style={styles.playerEmail}>{item.email}</Text>
              </View>
              {item.selected && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          style={styles.list}
          scrollEnabled={false} // Since we're inside a ScrollView
        />
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, selectedPlayers.length < 2 && styles.buttonDisabled]}
          onPress={createTournament}
          disabled={selectedPlayers.length < 2}
        >
          <Text style={styles.buttonText}>Create Tournament</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  formSection: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 20,
    marginBottom: 80, // Space for the footer
  },
  playerItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedPlayer: {
    backgroundColor: '#e0f7fa',
    borderColor: '#00b0ff',
    borderWidth: 1,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  playerEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00b0ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    flexDirection: 'row',
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    flex: 2,
    alignItems: 'center',
    marginRight: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
});

export default EliminationScreen;
