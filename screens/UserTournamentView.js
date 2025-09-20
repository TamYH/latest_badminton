import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import ResultsModal from '../modals/ResultsModal';

const UserTournamentView = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  // Check if a specific tournament was requested
  const tournamentId = route.params?.tournamentId;

  useEffect(() => {
    if (tournamentId) {
      // Load specific tournament if ID provided
      loadSingleTournament(tournamentId);
    } else {
      // Otherwise load all tournaments
      loadTournaments();
    }
  }, [tournamentId]);

  const loadSingleTournament = async (id) => {
    try {
      setLoading(true);
      const tournamentDoc = await getDoc(doc(db, 'tournaments', id));
      
      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        setSelectedTournament({
          id: tournamentDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      } else {
        Alert.alert("Error", "Tournament not found");
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error loading tournament:", error);
      Alert.alert("Error", "Failed to load tournament data");
    } finally {
      setLoading(false);
    }
  };

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const tournamentsQuery = query(
        collection(db, 'tournaments'), 
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(tournamentsQuery);
      
      const tournamentsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || `Tournament ${doc.id}`,
          totalTeams: data.totalTeams || 0,
          currentRound: data.currentRound || 1,
          completed: data.completed || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          matchCount: data.matchups?.length || 0
        };
      });
      
      setTournaments(tournamentsList);
    } catch (error) {
      console.error("Error loading tournaments:", error);
      Alert.alert("Error", "Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const handleTournamentSelect = async (tournamentId) => {
    try {
      setLoading(true);
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      
      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        setSelectedTournament({
          id: tournamentDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      } else {
        Alert.alert("Error", "Tournament not found");
      }
    } catch (error) {
      console.error("Error fetching tournament:", error);
      Alert.alert("Error", "Failed to load tournament details");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedTournament(null);
    loadTournaments(); // Refresh the list when going back
  };

  // Render tournament list
  const renderTournamentItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.tournamentItem}
      onPress={() => handleTournamentSelect(item.id)}
    >
      <Text style={styles.tournamentName}>{item.name}</Text>
      <Text style={styles.tournamentDetails}>
        Teams: {item.totalTeams} • Matches: {item.matchCount} • 
        Created: {item.createdAt.toLocaleDateString()}
      </Text>
      <Text style={[
        styles.tournamentStatus,
        { color: item.completed ? '#28a745' : '#007bff' }
      ]}>
        {item.completed ? 'Completed' : 'In Progress'}
      </Text>
    </TouchableOpacity>
  );

  // Render matchup item - read-only version
  const renderMatchupItem = ({ item, index }) => (
    <View 
      style={[
        styles.matchupItem,
        item.completed && styles.completedMatchup
      ]}
    >
      <Text style={styles.matchupTitle}>Round {item.round} - Match {index + 1}</Text>
      <View style={styles.teamsContainer}>
        <Text 
          style={[
            styles.teamName, 
            item.winner === item.team1Id && styles.winnerTeam
          ]}
        >
          {item.team1Name}
        </Text>
        <Text style={styles.vsText}>vs</Text>
        <Text 
          style={[
            styles.teamName, 
            item.winner === item.team2Id && styles.winnerTeam
          ]}
        >
          {item.team2Name}
        </Text>
      </View>
      {item.matchupTime && (
        <Text style={styles.matchupTimeText}>
          Match Time: {item.matchupTime}
        </Text>
      )}
      {item.completed && (
        <Text style={styles.winnerText}>
          Winner: {item.winner === item.team1Id ? item.team1Name : item.team2Name}
        </Text>
      )}
    </View>
  );

  // Loading indicator
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Tournament list view
  if (!selectedTournament) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Tournaments</Text>
          
          {tournaments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tournaments found</Text>
            </View>
          ) : (
            <FlatList
              data={tournaments}
              renderItem={renderTournamentItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Tournament detail view - read-only version
  return (
  <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <View style={styles.tournamentHeader}>
        <View style={styles.tournamentHeaderContent}>
          <Text style={styles.tournamentHeaderTitle}>{selectedTournament.name}</Text>
          <Text style={styles.tournamentHeaderDetails}>
            Created: {selectedTournament.createdAt ? selectedTournament.createdAt.toLocaleDateString() : 'Date unknown'}
          </Text>
          <Text style={styles.tournamentType}>
            Type: {selectedTournament.type === 'roundrobin' ? 'Round Robin' : 'Elimination'}
          </Text>
        </View>
        
        {/* Results Button */}
        <TouchableOpacity
          style={styles.resultsButton}
          onPress={() => setResultsModalVisible(true)}
        >
          <Text style={styles.resultsButtonText}>Results</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={selectedTournament.matchups}
        renderItem={({ item, index }) => {
          // Extract player names for round robin tournaments
          let player1Name = item.team1Name;
          let player2Name = item.team2Name;
          
          if (selectedTournament.type === 'roundrobin' && item.matchNumber) {
            if (item.player1Name && item.player2Name) {
              player1Name = item.player1Name.replace(/_gmail_com$/, '@gmail.com');
              player2Name = item.player2Name.replace(/_gmail_com$/, '@gmail.com');
            }
          }
          
          return (
            <View 
              style={[
                styles.matchupItem,
                item.completed && styles.completedMatchup
              ]}
            >
              <Text style={styles.matchupTitle}>Round {item.round} - Match {index + 1}</Text>
              
              <View style={styles.teamsContainer}>
                <Text style={styles.teamName}>{item.team1Name}</Text>
                <Text style={styles.vsText}>vs</Text>
                <Text style={styles.teamName}>{item.team2Name}</Text>
              </View>
              
              {/* Display player names for round robin */}
              {selectedTournament.type === 'roundrobin' && (
                <View style={styles.playerMatchupContainer}>
                  <Text style={styles.playerMatchupLabel}>Player Match {item.matchNumber || index + 1}</Text>
                  <View style={styles.playerMatchupRow}>
                    <Text 
                      style={[
                        styles.playerName, 
                        item.winner === item.team1Id && styles.winnerPlayer
                      ]}
                    >
                      {player1Name}
                    </Text>
                    <Text style={styles.vsTextSmall}>vs</Text>
                    <Text 
                      style={[
                        styles.playerName, 
                        item.winner === item.team2Id && styles.winnerPlayer
                      ]}
                    >
                      {player2Name}
                    </Text>
                  </View>
                </View>
              )}
              
              {item.matchupTime && (
                <Text style={styles.matchupTimeText}>
                  Match Time: {item.matchupTime}
                </Text>
              )}
              
              {item.completed && (
                <Text style={styles.winnerText}>
                  Winner: {item.winner === item.team1Id ? 
                    (selectedTournament.type === 'roundrobin' ? player1Name : item.team1Name) : 
                    (selectedTournament.type === 'roundrobin' ? player2Name : item.team2Name)}
                </Text>
              )}
            </View>
          );
        }}
        keyExtractor={(item, index) => `match-${item.round}-${index}`}
        contentContainerStyle={styles.matchupListContent}
        ListHeaderComponent={
          <Text style={styles.matchupListTitle}>
            Tournament Matchups ({selectedTournament.matchups.length})
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No matchups found for this tournament</Text>
        }
      />
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backToListButton}
          onPress={handleBackToList}
        >
          <Text style={styles.backToListButtonText}>Back to List</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.exitButtonText}>Home</Text>
        </TouchableOpacity>
      </View>
      
      {/* Add Results Modal */}
      <ResultsModal
        visible={resultsModalVisible}
        onClose={() => setResultsModalVisible(false)}
        tournament={selectedTournament}
      />
    </View>
  </SafeAreaView>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center'
  },
  listContent: {
    paddingBottom: 16
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 18,
    color: '#6c757d',
    marginBottom: 20,
    textAlign: 'center'
  },
  tournamentItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  tournamentDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4
  },
  tournamentStatus: {
    fontSize: 14,
    fontWeight: '500'
  },
  tournamentHeader: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  tournamentHeaderTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8
  },
  tournamentHeaderDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)'
  },
  matchupListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#343a40'
  },
  matchupListContent: {
    paddingBottom: 16
  },
  matchupItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6c757d',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1
  },
  completedMatchup: {
    borderLeftColor: '#28a745'
  },
  matchupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#495057'
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  teamName: {
    fontSize: 16,
    flex: 1,
    color: '#212529'
  },
  winnerTeam: {
    fontWeight: 'bold',
    color: '#28a745'
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc3545',
    marginHorizontal: 10
  },
  winnerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#28a745',
    marginTop: 4
  },
  matchupTimeText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6c757d',
    marginVertical: 4
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  backToListButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    flex: 1,
    marginRight: 8
  },
  backToListButtonText: {
    color: 'white',
    fontSize: 25,
    fontWeight: '500',
    textAlign: 'center'
  },
  backButton: {
    backgroundColor: '#6c757d',
    borderRadius: 6,
    height: '12%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 30,
    fontWeight: '500',
    textAlign: 'center'
  },
  exitButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8
  },
  exitButtonText:{
    color: 'white',
    fontSize: 25,
    fontWeight: '500',
    textAlign: 'center'
  },
  tournamentHeaderContent: {
  flex: 1,
},
resultsButton: {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 8,
  paddingVertical: 5,
  paddingHorizontal: 20,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.3)',
  marginLeft: 1,
},
resultsButtonText: {
  color: 'white',
  fontSize: 18,
  fontWeight: 'bold',
  textAlign: 'center',
},
tournamentType: {
  fontSize: 16,
  fontWeight: '500',
  color: 'rgba(255, 255, 255, 0.9)',
  marginTop: 8,
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderRadius: 12,
  alignSelf: 'flex-start',
},

playerMatchupContainer: {
  marginTop: 8,
  backgroundColor: '#f1f8ff',
  padding: 10,
  borderRadius: 6,
  borderLeftWidth: 2,
  borderLeftColor: '#007bff',
},
playerMatchupLabel: {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#0056b3',
  marginBottom: 4,
},
playerMatchupRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
playerName: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  flex: 1,
},
vsTextSmall: {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#dc3545',
  marginHorizontal: 8,
},
winnerPlayer: {
  color: '#28a745',
  fontWeight: 'bold',
}

});

export default UserTournamentView;