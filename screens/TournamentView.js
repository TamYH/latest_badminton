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
  deleteDoc,
  where
} from 'firebase/firestore';
import ResultsModal from '../modals/ResultsModal';

const TournamentView = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [matchupTime, setMatchupTime] = useState('');
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
const [resultsModalVisible, setResultsModalVisible] = useState(false);

  // Check if a specific tournament was requested
  const tournamentId = route.params?.tournamentId;

useEffect(() => {
  const fetchTournament = async () => {
    // First check if we're in list mode without a specific tournament ID
    if (!route.params?.tournamentId) {
      // If we're just viewing the list of tournaments, load all tournaments
      loadTournaments();
      return;
    }
    
    try {
      setLoading(true);
      console.log("Fetching tournament with ID:", route.params.tournamentId); // Debug log
      
      const tournamentRef = doc(db, 'tournaments', route.params.tournamentId);
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (!tournamentSnap.exists()) {
        console.log("Tournament document not found"); // Debug log
        Alert.alert('Error', 'Tournament not found');
        navigation.goBack();
        return;
      }
      
      const tournamentData = {
        id: tournamentSnap.id,
        ...tournamentSnap.data(),
         // Handle createdAt safely
        createdAt: tournamentSnap.data().createdAt?.toDate ? 
          tournamentSnap.data().createdAt.toDate() : 
          new Date()
      };
      
      console.log("Tournament data loaded:", tournamentData); // Debug log
      
      // Redirect to TourRegister if tournament is unstarted
      if (tournamentData.status === 'unstarted') {
        Alert.alert(
          'Tournament Not Started',
          'This tournament has not started yet. You can view it in the Tournament Registration screen.',
          [
            {
              text: 'Go to Registration',
              onPress: () => navigation.replace('TourRegister')
            },
            {
              text: 'Back',
              onPress: () => navigation.goBack(),
              style: 'cancel'
            }
          ]
        );
        setLoading(false);
        return;
      }
      
      setSelectedTournament(tournamentData);
      
    } catch (error) {
      console.error('Error fetching tournament:', error);
      Alert.alert('Error', 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };
  
  fetchTournament();
}, [route.params?.tournamentId]);

  const loadSingleTournament = async (id) => {
    try {
      setLoading(true);
      const tournamentDoc = await getDoc(doc(db, 'tournaments', id));

      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        setSelectedTournament({
          id: tournamentDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
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
    
    // Option 1: Use simpler query to avoid index requirements
    const tournamentsQuery = query(
      collection(db, 'tournaments'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(tournamentsQuery);

    const tournamentsList = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Filter out unstarted tournaments in JavaScript instead of in the query
      if (data.status === 'unstarted') {
        return null; // Will be filtered out below
      }
      
      return {
        id: doc.id,
        name: data.name || `Tournament ${doc.id}`,
        totalTeams: data.totalTeams || 0,
        currentRound: data.currentRound || 1,
        completed: data.completed || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        matchCount: data.matchups?.length || 0,
        status: data.status || 'in-progress'
      };
    }).filter(Boolean); // Remove null items (unstarted tournaments)

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

 

 
const updateMatchupWinner = async (winner) => {
  if (!selectedMatchup || !selectedTournament) return;

  try {
    setModalVisible(false);
    setLoading(true);

    // Find the EXACT matchup
    const matchupIndex = selectedTournament.matchups.findIndex(
      m => m.team1Id === selectedMatchup.team1Id &&
        m.team2Id === selectedMatchup.team2Id &&
        m.round === selectedMatchup.round &&
        m.matchNumber === selectedMatchup.matchNumber
    );

    if (matchupIndex === -1) {
      throw new Error("Matchup not found");
    }

    // Check if winner is changing from a previous selection
    const previousWinner = selectedTournament.matchups[matchupIndex].winner;
    const isWinnerChange = previousWinner && previousWinner !== winner;

    // Create updated matchups array
    const updatedMatchups = [...selectedTournament.matchups];
    updatedMatchups[matchupIndex] = {
      ...updatedMatchups[matchupIndex],
      winner: winner,
      completed: true
    };

    // If changing winner from previous rounds, update subsequent matches instead of creating new ones
    if (isWinnerChange && selectedTournament.type === 'elimination') {
      const currentRound = selectedMatchup.round;
      
      // Find and update subsequent matches that included the previous winner
      const subsequentMatches = updatedMatchups.filter(m => m.round > currentRound);
      
      for (let match of subsequentMatches) {
        // If this match contains the previous winner, update it with new winner
        if (match.team1Id === previousWinner) {
          match.team1Id = winner;
          match.team1Name = winner === selectedMatchup.team1Id ? selectedMatchup.team1Name : selectedMatchup.team2Name;
          // Reset match if it was completed
          if (match.completed) {
            match.completed = false;
            match.winner = null;
          }
        } else if (match.team2Id === previousWinner) {
          match.team2Id = winner;
          match.team2Name = winner === selectedMatchup.team1Id ? selectedMatchup.team1Name : selectedMatchup.team2Name;
          // Reset match if it was completed
          if (match.completed) {
            match.completed = false;
            match.winner = null;
          }
        }
      }

      // Update database with modified matches
      const tournamentRef = doc(db, 'tournaments', selectedTournament.id);
      await updateDoc(tournamentRef, {
        matchups: updatedMatchups,
        // Reset championship if it was already decided
        completed: false,
        champion: null,
        championName: null
      });

      // Update local state
      setSelectedTournament(prev => ({
        ...prev,
        matchups: updatedMatchups,
        completed: false,
        champion: null,
        championName: null
      }));

      Alert.alert("Success", "Winner updated and subsequent matches have been reset");
      setLoading(false);
      setSelectedMatchup(null);
      return;
    }

    // Update database first
    const tournamentRef = doc(db, 'tournaments', selectedTournament.id);
    await updateDoc(tournamentRef, {
      matchups: updatedMatchups
    });

    // Update local state immediately
    setSelectedTournament(prev => ({
      ...prev,
      matchups: updatedMatchups
    }));

    // Handle elimination tournament round completion for new matches only
    if (selectedTournament.type === 'elimination') {
      const currentRound = selectedMatchup.round;
      const currentRoundMatches = updatedMatchups.filter(m => m.round === currentRound);
      const completedMatches = currentRoundMatches.filter(m => m.completed);

      // If all matches in current round are complete
      if (currentRoundMatches.length === completedMatches.length) {
        // Check if next round already exists to avoid duplicates
        const nextRoundExists = updatedMatchups.some(m => m.round > currentRound);
        
        if (!nextRoundExists) {
          // Get winners from current round
          const winners = completedMatches.map(match => ({
            id: match.winner,
            name: match.winner === match.team1Id ? match.team1Name : match.team2Name
          })).filter(w => w.id);

          console.log(`Round ${currentRound} complete. Winners:`, winners);

          if (winners.length === 1) {
            // Tournament complete - crown champion
            await updateDoc(tournamentRef, {
              completed: true,
              champion: winners[0].id,
              championName: winners[0].name
            });

            setSelectedTournament(prev => ({
              ...prev,
              completed: true,
              champion: winners[0].id,
              championName: winners[0].name
            }));

            Alert.alert("🏆 CHAMPION! 🏆", `${winners[0].name} is the tournament champion!`);
          } else if (winners.length > 1) {
            // Generate next round only if it doesn't exist
            await generateNextRound(currentRound, winners, updatedMatchups);
          }
        }
      }
    }

    Alert.alert("Success", "Winner updated successfully");
  } catch (error) {
    console.error("Error updating matchup:", error);
    Alert.alert("Error", "Failed to update matchup: " + error.message);
  } finally {
    setLoading(false);
    setSelectedMatchup(null);
  }
};
const generateNextRound = async (currentRound, winners, currentMatchups) => {
  const nextRound = currentRound + 1;
  const nextRoundMatches = [];

  // Handle odd number of winners (one gets bye)
  const winnersCopy = [...winners];
  if (winnersCopy.length % 2 !== 0) {
    const playerWithBye = winnersCopy.pop();
    nextRoundMatches.push({
      round: nextRound,
      team1Id: playerWithBye.id,
      team2Id: `bye-${Date.now()}`,
      team1Name: playerWithBye.name,
      team2Name: "BYE",
      matchNumber: 1,
      completed: true,
      winner: playerWithBye.id,
      isBye: true
    });
  }

  // Pair remaining winners
  for (let i = 0; i < winnersCopy.length; i += 2) {
    if (i + 1 < winnersCopy.length) {
      nextRoundMatches.push({
        round: nextRound,
        team1Id: winnersCopy[i].id,
        team2Id: winnersCopy[i + 1].id,
        team1Name: winnersCopy[i].name,
        team2Name: winnersCopy[i + 1].name,
        matchNumber: nextRoundMatches.length + 1,
        completed: false,
        winner: null
      });
    }
  }

  if (nextRoundMatches.length > 0) {
    const allMatchups = [...currentMatchups, ...nextRoundMatches];
    
    // Update database
    const tournamentRef = doc(db, 'tournaments', selectedTournament.id);
    await updateDoc(tournamentRef, {
      matchups: allMatchups,
      currentRound: nextRound
    });

    // Update local state immediately
    setSelectedTournament(prev => ({
      ...prev,
      matchups: allMatchups,
      currentRound: nextRound
    }));

    console.log(`Generated round ${nextRound} with ${nextRoundMatches.length} matches`);
  }
};
// Also update the saveMatchupTime function to use the same logic:
const saveMatchupTime = async () => {
  if (!selectedMatchup || !selectedTournament) return;

  try {
    setTimeModalVisible(false);
    setLoading(true);

    // Find the EXACT matchup by including matchNumber
    const matchupIndex = selectedTournament.matchups.findIndex(
      m => m.team1Id === selectedMatchup.team1Id &&
        m.team2Id === selectedMatchup.team2Id &&
        m.round === selectedMatchup.round &&
        m.matchNumber === selectedMatchup.matchNumber // Add this line
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
  const renderMatchupItem = ({ item, index }) => {
    // Check if this is a bye match
  const isBye = item.isBye || item.team2Id?.startsWith("bye-") || item.team2Name === "BYE";
    // Extract player names based on matchNumber in round robin tournaments
    let player1Name = item.team1Name;
    let player2Name = item.team2Name;

    // For round robin tournaments, get individual player names
    if (selectedTournament.type === 'roundrobin' && item.matchNumber) {
      // These would be the individual player matchups
      if (item.player1Name && item.player2Name) {
        player1Name = item.player1Name;
        player2Name = item.player2Name;
      } else {
        // If player names aren't directly stored, construct from team members
        // This assumes team members are stored in order by position
        const team1 = selectedTournament.teams?.find(t => t.id === item.team1Id);
        const team2 = selectedTournament.teams?.find(t => t.id === item.team2Id);

        if (team1 && team2 && team1.memberIds && team2.memberIds) {
          // Match number (1-5) corresponds to player position in team (0-4)
          const playerIndex = (item.matchNumber - 1) % 5;
          // Try to get player names from memberIds array if available
          const memberId1 = team1.memberIds[playerIndex];
          const memberId2 = team2.memberIds[playerIndex];

          // If we have email-like memberIds (as shown in your Firebase), extract name part
          if (memberId1 && memberId1.includes('_gmail_com')) {
            player1Name = memberId1.split('_gmail_com')[0].replace(/^"/, '');
          }

          if (memberId2 && memberId2.includes('_gmail_com')) {
            player2Name = memberId2.split('_gmail_com')[0].replace(/^"/, '');
          }
        }
      }
    }

    return (
      <TouchableOpacity
        style={[
          styles.matchupItem,
          item.completed && styles.completedMatchup,
          isBye && styles.byeMatch
        ]}
        onPress={() => isBye ? null : openMatchupModal(item)} // Disable press for bye matches
      disabled={isBye} // Add this line to disable touch for bye matches
      >
        <Text style={styles.matchupTitle}>Round {item.round} - Match {index + 1}</Text>

        {/* Show team names as context */}
        <View style={styles.teamsContainer}>
          <Text style={styles.teamLabel}>{item.team1Name}</Text>
          <Text style={styles.vsText}>vs</Text>
          <Text style={styles.teamLabel}>{item.team2Name}</Text>
        </View>

        {/* Show the actual player matchup */}
        <View style={styles.playerMatchupContainer}>
          <Text style={styles.playerMatchupLabel}>
            {selectedTournament.type === 'roundrobin' ? `Player Match ${item.matchNumber || index + 1}` : 'Match'}
          </Text>
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

        {item.matchupTime && (
          <Text style={styles.matchupTimeText}>
            Match Time: {item.matchupTime}
          </Text>
        )}

        {item.completed && (
          <Text style={styles.winnerText}>
            Winner: {item.winner === item.team1Id ? player1Name : player2Name}
          </Text>
        )}
        {/* Add this block - shows orange "Auto-advance" text */}
      {isBye && (
        <Text style={styles.byeExplanation}>
          Auto-advance To Next Round
        </Text>
      )}
      </TouchableOpacity>
    );
  };



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
  <View style={styles.tournamentHeaderContent}>
    <Text style={styles.tournamentHeaderTitle}>{selectedTournament.name}</Text>
    <Text style={styles.tournamentHeaderDetails}>
      Created: {selectedTournament.createdAt ? selectedTournament.createdAt.toLocaleDateString() : 'Date unknown'}
    </Text>
    <Text style={styles.tournamentType}>Type: {selectedTournament.type === 'roundrobin' ? 'Round Robin' : 'Elimination'}</Text>
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
      <ResultsModal
  visible={resultsModalVisible}
  onClose={() => setResultsModalVisible(false)}
  tournament={selectedTournament}
/>

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
  exitButtonText: {
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
    padding: 8,
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
  playerMatchupText: {
    fontSize: 14,
    color: '#0056b3',
  },
  teamLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flex: 1,
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
  },

tournamentHeaderContent: {
  flex: 1,
},
resultsButton: {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 8,
  paddingVertical: 5,
  paddingHorizontal: 20
 
  ,
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

byeMatch: {
  backgroundColor: '#fff3cd',
  borderLeftColor: '#fd7e14',
  opacity: 0.8,
},
byeExplanation: {
  fontSize: 12,
  fontStyle: 'italic',
  color: '#fd7e14',
  marginTop: 4,
}

});

export default TournamentView;



