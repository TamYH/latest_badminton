import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CreateTourScreen = ({ navigation }) => {
  const [tournamentName, setTournamentName] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);

  const createTournament = async () => {
    if (!tournamentName.trim()) {
      Alert.alert('Error', 'Please enter a tournament name');
      return;
    }

    if (!selectedType) {
      Alert.alert('Error', 'Please select a tournament type');
      return;
    }
    
    try {
      setLoading(true);
      
      // Make sure we initialize all array properties
      const tournamentData = {
        name: tournamentName,
        type: selectedType, // 'elimination' or 'roundrobin'
        createdAt: new Date(),
        createdBy: auth.currentUser ? auth.currentUser.uid : null,
        status: 'unstarted',
        pendingRegistrations: [], // Initialize empty array
        approvedRegistrations: [], // Initialize empty array
        teams: [], // Add this to avoid undefined errors
        players: [], // Add this to avoid undefined errors
        matchups: [], // Add this to avoid undefined errors
        completed: false
      };
      
      const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
      
      setLoading(false);
      Alert.alert(
        'Success', 
        'Tournament created successfully', 
        [
          {
            text: 'Manage Tournament',
            onPress: () => navigation.navigate('TourRegister')
          },
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );
      
      // Reset form
      setTournamentName('');
      setSelectedType(null);
      
    } catch (error) {
      console.error('Error creating tournament:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to create tournament: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      <Text style={styles.title}>Create Tournament</Text>
      <Text style={styles.subtitle}>Set up a new tournament</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Tournament Name</Text>
        <TextInput
          style={styles.input}
          value={tournamentName}
          onChangeText={setTournamentName}
          placeholder="Enter tournament name"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Select Tournament Type</Text>
        <View style={styles.typeContainer}>
          <TouchableOpacity 
            style={[
              styles.typeButton, 
              selectedType === 'elimination' && styles.selectedTypeButton
            ]}
            onPress={() => setSelectedType('elimination')}
          >
            <Ionicons 
              name="trophy-outline" 
              size={30} 
              color={selectedType === 'elimination' ? "#fff" : "#1368CE"}
            />
            <Text style={[
              styles.typeText,
              selectedType === 'elimination' && styles.selectedTypeText
            ]}>
              Elimination
            </Text>
            <Text style={[
              styles.typeDescription,
              selectedType === 'elimination' && styles.selectedTypeText
            ]}>
              Bracket-style knockout tournament
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.typeButton, 
              selectedType === 'roundrobin' && styles.selectedTypeButton
            ]}
            onPress={() => setSelectedType('roundrobin')}
          >
            <Ionicons 
              name="repeat-outline" 
              size={30} 
              color={selectedType === 'roundrobin' ? "#fff" : "#E21B3C"} 
            />
            <Text style={[
              styles.typeText,
              selectedType === 'roundrobin' && styles.selectedTypeText
            ]}>
              Round Robin
            </Text>
            <Text style={[
              styles.typeDescription,
              selectedType === 'roundrobin' && styles.selectedTypeText
            ]}>
              Everyone plays against everyone
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={24} color="#666" />
          <Text style={styles.infoText}>
            {selectedType === 'elimination' 
              ? 'In Elimination tournaments, players compete in brackets. Losers are eliminated, winners advance to the next round.'
              : selectedType === 'roundrobin'
                ? 'In Round Robin tournaments, each team plays against every other team. Teams must have exactly 5 players.'
                : 'Select a tournament type to see more information.'
            }
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1368CE" />
          <Text style={styles.loadingText}>Creating tournament...</Text>
        </View>
      ) : (
        <TouchableOpacity 
          style={[
            styles.createButton,
            (!tournamentName.trim() || !selectedType) && styles.disabledButton
          ]}
          disabled={!tournamentName.trim() || !selectedType}
          onPress={createTournament}
        >
          <Text style={styles.createButtonText}>Create Tournament</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  typeButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  selectedTypeButton: {
    backgroundColor: '#1368CE',
    borderColor: '#1368CE',
  },
  typeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  selectedTypeText: {
    color: '#fff',
  },
  typeDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#1368CE',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});

export default CreateTourScreen;
