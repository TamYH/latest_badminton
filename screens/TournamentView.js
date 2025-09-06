import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  TextInput
} from 'react-native';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';

const TournamentView = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [matchupTime, setMatchupTime] = useState('');
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);

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

  const openMatchupModal = (matchup) => {
    setSelectedMatchup(matchup);
    setModalVisible(true);
  };

  const openTimeModal = () => {
    setModalVisible(false);
    setMatchupTime(selectedMatchup.matchupTime || '');
    setTimeModalVisible(true);
  };

  const saveMatchupTime = async () => {
    if (!selectedMatchup || !selectedTournament) return;
    
    try {
      setTimeModalVisible(false);
      setLoading(true);
      
      // Find index of the matchup in the array
      const matchupIndex = selectedTournament.matchups.findIndex(
        m => m.team1Id === selectedMatchup.team1Id && 
             m.team2Id === selectedMatchup.team2Id &&
             m.round === selectedMatchup.round
      );
      
      if (matchupIndex === -1) {
        throw new Error("Matchup not found");
      }
      
      // Create updated matchups array
      const updatedMatchups = [...selectedTournament.matchups];
      updatedMatchups[matchupIndex] = {
        ...updatedMatchups[matchupIndex],
        matchupTime: matchupTime
      };
      
      // Update document in Firestore
      const tournamentRef = doc(db, 'tournaments', selectedTournament.id);
      await updateDoc(tournamentRef, {
        matchups: updatedMatchups
      });
      
      // Refresh the tournament data
      await loadSingleTournament(selectedTournament.id);
      
      Alert.alert("Success", "Match time updated successfully");
    } catch (error) {
      console.error("Error updating matchup time:", error);
      Alert.alert("Error", "Failed to update matchup time");
    } finally {
      setLoading(false);
    }
  };

  const updateMatchupWinner = async (winner) => {
    if (!selectedMatchup || !selectedTournament) return;
    
    try {
      setModalVisible(false);
      setLoading(true);
      
      // Find index of the matchup in the array
      const matchupIndex = selectedTournament.matchups.findIndex(
        m => m.team1Id === selectedMatchup.team1Id && 
             m.team2Id === selectedMatchup.team2Id &&
             m.round === selectedMatchup.round
      );
      
      if (matchupIndex === -1) {
        throw new Error("Matchup not found");
      }
      
      // Create updated matchups array
      const updatedMatchups = [...selectedTournament.matchups];
      updatedMatchups[matchupIndex] = {
        ...updatedMatchups[matchupIndex],
        winner: winner,
        completed: true
      };
      
      // Update document in Firestore
      const tournamentRef = doc(db, 'tournaments', selectedTournament.id);
      await updateDoc(tournamentRef, {
        matchups: updatedMatchups
      });
      
      // Refresh the tournament data
      await loadSingleTournament(selectedTournament.id);
      
      Alert.alert("Success", "Winner updated successfully");
    } catch (error) {
      console.error("Error updating matchup:", error);
      Alert.alert("Error", "Failed to update matchup");
    } finally {
      setLoading(false);
      setSelectedMatchup(null);
    }
  };

  // New function to delete a tournament
  const deleteTournament = async () => {
    if (!selectedTournament) return;
    
    try {
      setDeleteConfirmModalVisible(false);
      setLoading(true);
      
      // Delete the tournament document from Firestore
      await deleteDoc(doc(db, 'tournaments', selectedTournament.id));
      
      Alert.alert(
        "Success", 
        "Tournament deleted successfully",
        [{ text: "OK", onPress: handleBackToList }]
      );
    } catch (error) {
      console.error("Error deleting tournament:", error);
      setLoading(false);
      Alert.alert("Error", "Failed to delete tournament");
    }
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

  // Render matchup item
  const renderMatchupItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.matchupItem,
        item.completed && styles.completedMatchup
      ]}
      onPress={() => openMatchupModal(item)}
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
    </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate('TeamRollerWheel')}
              >
                <Text style={styles.createButtonText}>Create New Tournament</Text>
              </TouchableOpacity>
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

  // Tournament detail view
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.tournamentHeader}>
          <Text style={styles.tournamentHeaderTitle}>{selectedTournament.name}</Text>
          <Text style={styles.tournamentHeaderDetails}>
            Created: {selectedTournament.createdAt.toLocaleDateString()}
          </Text>
        </View>
        
        <FlatList
          data={selectedTournament.matchups}
          renderItem={renderMatchupItem}
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
            style={styles.deleteButton}
            onPress={() => setDeleteConfirmModalVisible(true)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.exitButtonText}>Exit</Text>
          </TouchableOpacity>
        </View>

        {/* Winner Selection Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Winner</Text>
              
              {selectedMatchup && (
                <>
                  <Text style={styles.modalMatchupTitle}>
                    Round {selectedMatchup.round} Matchup
                  </Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.winnerButton,
                      selectedMatchup.winner === selectedMatchup.team1Id && styles.selectedWinnerButton
                    ]}
                    onPress={() => updateMatchupWinner(selectedMatchup.team1Id)}
                  >
                    <Text style={styles.winnerButtonText}>{selectedMatchup.team1Name}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.winnerButton,
                      selectedMatchup.winner === selectedMatchup.team2Id && styles.selectedWinnerButton
                    ]}
                    onPress={() => updateMatchupWinner(selectedMatchup.team2Id)}
                  >
                    <Text style={styles.winnerButtonText}>{selectedMatchup.team2Name}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={openTimeModal}
                  >
                    <Text style={styles.timeButtonText}>
                      {selectedMatchup.matchupTime ? 'Update Match Time' : 'Add Match Time'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Time Entry Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={timeModalVisible}
          onRequestClose={() => setTimeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Match Time</Text>
              
              {selectedMatchup && (
                <>
                  <Text style={styles.modalMatchupTitle}>
                    {selectedMatchup.team1Name} vs {selectedMatchup.team2Name}
                  </Text>
                  
                  <TextInput
                    style={styles.timeInput}
                    value={matchupTime}
                    onChangeText={setMatchupTime}
                    placeholder="Enter match time (e.g., 3:30 PM)"
                    placeholderTextColor="#aaa"
                  />
                  
                  <View style={styles.timeModalButtons}>
                    <TouchableOpacity
                      style={styles.saveTimeButton}
                      onPress={saveMatchupTime}
                    >
                      <Text style={styles.saveTimeButtonText}>Save</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.cancelTimeButton}
                      onPress={() => {
                        setTimeModalVisible(false);
                        setModalVisible(true); // Go back to winner selection modal
                      }}
                    >
                      <Text style={styles.cancelTimeButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={deleteConfirmModalVisible}
          onRequestClose={() => setDeleteConfirmModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete Tournament</Text>
              <Text style={styles.deleteConfirmText}>
                Are you sure you want to delete "{selectedTournament.name}"? This action cannot be undone.
              </Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={styles.deleteConfirmButton}
                  onPress={deleteTournament}
                >
                  <Text style={styles.deleteConfirmButtonText}>Delete</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.cancelDeleteButton}
                  onPress={() => setDeleteConfirmModalVisible(false)}
                >
                  <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    marginBottom: 16
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
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    flex: 1,
    marginRight: 8
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 25,
    fontWeight: '500',
    textAlign: 'center'
  },
  createButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500'
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
    flex: 1
  },
  exitButtonText:{
    color: 'white',
    fontSize: 25,
    fontWeight: '500',
    textAlign: 'center'
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#343a40'
  },
  modalMatchupTitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    color: '#6c757d'
  },
  winnerButton: {
    backgroundColor: '#e9ecef',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12
  },
  selectedWinnerButton: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1
  },
  winnerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: '#212529'
  },
  timeButton: {
    backgroundColor: '#17a2b8',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: 'white'
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderColor: '#dee2e6',
    borderWidth: 1,
    marginTop: 8
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: '#6c757d'
  },
  // Time modal styles
  timeInput: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderColor: '#ced4da',
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 16
  },
  timeModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  saveTimeButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    flex: 1,
    marginRight: 8
  },
  saveTimeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: 'white'
  },
  cancelTimeButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderColor: '#ced4da',
    borderWidth: 1,
    flex: 1,
    marginLeft: 8
  },
  cancelTimeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: '#6c757d'
  },
  // Delete confirmation modal styles
  deleteConfirmText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#6c757d'
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  deleteConfirmButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 6,
    flex: 1,
    marginRight: 8
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: 'white'
  },
  cancelDeleteButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderColor: '#ced4da',
    borderWidth: 1,
    flex: 1,
    marginLeft: 8
  },
  cancelDeleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: '#6c757d'
  }
});

export default TournamentView;