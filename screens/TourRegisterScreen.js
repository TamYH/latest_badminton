import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase/config';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';

const TourRegisterScreen = ({ navigation }) => {
  const [tournaments, setTournaments] = useState([]);
  const [userTeams, setUserTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [registrationModalVisible, setRegistrationModalVisible] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState({});
  const [approvalsModalVisible, setApprovalsModalVisible] = useState(false);
  const [currentApprovals, setCurrentApprovals] = useState([]);

  const auth = getAuth();
  const user = auth.currentUser;

  useFocusEffect(
    React.useCallback(() => {
      checkAdminStatus();
      fetchTournaments();
      if (user) {
        fetchUserTeams();
      }
      
      // Optional cleanup function
      return () => {
        // Any cleanup code if needed
      };
    }, [user])
  );

  const checkAdminStatus = async () => {
  if (user) {
    try {
      // Use the same email sanitization format as your Firebase structure
      const sanitizedEmail = user.email.replace(/[@.]/g, '_');
      const userRef = doc(db, 'users', sanitizedEmail);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log('Checking admin status for:', sanitizedEmail, userData);
        if (userData.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        console.log('User document not found for:', sanitizedEmail);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  }
};


  const fetchTournaments = async () => {
    setLoading(true);
    try {
      // Get tournaments with "unstarted" status
      const tournamentsQuery = query(
        collection(db, 'tournaments'),
        where('status', '==', 'unstarted')
      );
      
      const querySnapshot = await getDocs(tournamentsQuery);
      const tournamentsData = [];
      
      querySnapshot.forEach((doc) => {
        tournamentsData.push({
          id: doc.id,
          ...doc.data(),
          pendingRegistrations: doc.data().pendingRegistrations || [],
          approvedRegistrations: doc.data().approvedRegistrations || []
        });
      });
      
      setTournaments(tournamentsData);
      
      // Process pending registrations for admin view
      if (isAdmin) {
        const registrationsMap = {};
        for (const tournament of tournamentsData) {
          if (tournament.pendingRegistrations && tournament.pendingRegistrations.length > 0) {
            registrationsMap[tournament.id] = tournament.pendingRegistrations.length;
          }
        }
        setPendingRegistrations(registrationsMap);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      Alert.alert("Error", "Failed to fetch tournaments");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTeams = async () => {
  try {
    // Get user's sanitized email to match the memberIds format
    const sanitizedEmail = user.email.replace(/[@.]/g, '_');
    
    // Query teams where the user is a member
    const teamsQuery = query(collection(db, 'teams'));
    const querySnapshot = await getDocs(teamsQuery);
    const teamsData = [];
    
    querySnapshot.forEach((doc) => {
      const team = doc.data();
      
      // Check if current user is in the memberIds array
      if (team.memberIds && team.memberIds.includes(sanitizedEmail)) {
        teamsData.push({
          id: doc.id,
          name: team.name,
          members: team.memberIds || [],
          memberIds: team.memberIds || [],
          valid: team.memberIds && team.memberIds.length === 5
        });
      }
    });
    
    setUserTeams(teamsData);
    console.log('User teams found:', teamsData);
  } catch (error) {
    console.error("Error fetching user teams:", error);
  }
};

  const registerForTournament = async () => {
    if (!selectedTournament) return;
    
    try {
      const tournamentRef = doc(db, 'tournaments', selectedTournament.id);
      
      // For Round Robin tournaments, a team registration is required
      if (selectedTournament.type === 'roundrobin') {
        if (!selectedTeam) {
          Alert.alert("Error", "Please select a team to register");
          return;
        }
        
        // Check if team has exactly 5 members
        if (!selectedTeam.valid) {
          Alert.alert("Error", "Round Robin teams must have exactly 5 members");
          return;
        }
        
        // Register team
        await updateDoc(tournamentRef, {
          pendingRegistrations: arrayUnion({
            userId: user.uid,
            userName: user.displayName || user.email,
            timestamp: new Date(),
            type: 'team',
            teamId: selectedTeam.id,
            teamName: selectedTeam.name,
            members: selectedTeam.members
          })
        });
      } else {
        // For Elimination tournaments, individual registration
        await updateDoc(tournamentRef, {
          pendingRegistrations: arrayUnion({
            userId: user.uid,
            userName: user.displayName || user.email,
            timestamp: new Date(),
            type: 'individual'
          })
        });
      }
      
      Alert.alert("Success", "Tournament registration submitted for approval");
      setRegistrationModalVisible(false);
      setSelectedTournament(null);
      setSelectedTeam(null);
      fetchTournaments(); // Refresh tournament list
    } catch (error) {
      console.error("Error registering for tournament:", error);
      Alert.alert("Error", "Failed to register for tournament");
    }
  };

  const handleStartTournament = async (tournament) => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournament.id);
    
    // Different validation based on tournament type
    if (tournament.type === 'elimination') {
      // For elimination tournaments, we need at least 2 players
      const individualRegistrations = tournament.approvedRegistrations?.filter(reg => reg.type === 'individual') || [];
      if (individualRegistrations.length < 2) {
        Alert.alert("Error", "At least 2 players are needed for an elimination tournament");
        return;
      }
      
      // Prepare players array for elimination tournament
      const players = individualRegistrations.map(reg => ({
        id: reg.userId,
        name: reg.userName,
        eliminated: false
      }));
      
      // Generate initial elimination matchups
      const initialMatchups = generateEliminationMatchups(players);

      await updateDoc(tournamentRef, {
        status: 'in-progress',
        players: players,
        currentRound: 1,
        matchups: initialMatchups
      });
    } else {
      // For round robin tournaments, we need at least 2 teams with 5 players each
      const teamRegistrations = tournament.approvedRegistrations?.filter(reg => reg.type === 'team') || [];
      if (teamRegistrations.length < 2) {
        Alert.alert("Error", "At least 2 teams are needed for a round robin tournament");
        return;
      }
      
      // Verify all teams have exactly 5 players
      const invalidTeams = teamRegistrations.filter(team => !team.members || team.members.length !== 5);
      if (invalidTeams.length > 0) {
        Alert.alert("Error", "All teams must have exactly 5 players for round robin tournaments");
        return;
      }
      
      // Generate round robin matchups
      const roundRobinMatchups = generateRoundRobinMatchups(teamRegistrations);
      
      // Prepare teams array for round robin tournament
      await updateDoc(tournamentRef, {
        status: 'in-progress',
        teams: teamRegistrations,
        currentRound: 1,
        matchups: roundRobinMatchups
      });
    }
    
    Alert.alert(
      "Tournament Started", 
      "The tournament has been started successfully",
      [
        {
          text: "View Tournament",
          onPress: () => navigation.navigate('TournamentView', { tournamentId: tournament.id })
        },
        {
          text: "OK",
          style: "default"
        }
      ]
    );
    
    fetchTournaments(); // Refresh tournament list
  } catch (error) {
    console.error("Error starting tournament:", error);
    Alert.alert("Error", "Failed to start tournament: " + error.message);
  }
};

// To generate matchups for tournaments
const generateEliminationMatchups = (players) => {
  const matchups = [];
  
  // Create a copy and shuffle players for randomized matchups
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  
  console.log(`Creating elimination matchups for ${shuffledPlayers.length} players`);
  
  // Handle case where we have odd number of players
  let hasBye = false;
  let byePlayer = null;
  
  if (shuffledPlayers.length % 2 !== 0) {
    // Select a random player to receive a bye
    const byeIndex = Math.floor(Math.random() * shuffledPlayers.length);
    byePlayer = shuffledPlayers.splice(byeIndex, 1)[0];
    hasBye = true;
    
    console.log(`Player ${byePlayer.name} received a bye in round 1`);
  }
  
  // Create normal first round matchups for the rest of the players
  let matchNumber = 1;
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    if (i + 1 < shuffledPlayers.length) {
      const player1 = shuffledPlayers[i];
      const player2 = shuffledPlayers[i + 1];
      
      matchups.push({
        round: 1,
        team1Id: player1.id,
        team2Id: player2.id,
        team1Name: player1.name,
        team2Name: player2.name,
        matchNumber: matchNumber,
        completed: false,
        winner: null,
        matchupTime: null
      });
      
      matchNumber++;
    }
  }
  
  // If we have a bye player, add a "virtual match" that's already completed
  if (hasBye) {
    // Create a virtual opponent for display purposes
    const virtualOpponent = {
      id: `bye-${Date.now()}`,
      name: "BYE"
    };
    
    matchups.push({
      round: 1,
      team1Id: byePlayer.id,
      team2Id: virtualOpponent.id,
      team1Name: byePlayer.name,
      team2Name: virtualOpponent.name,
      matchNumber: matchNumber,
      completed: true,  // This match is automatically completed
      winner: byePlayer.id,  // Bye player automatically advances
      matchupTime: null,
      isBye: true  // Mark as a bye match for special handling in UI
    });
  }
  
  return matchups;
};

const generateRoundRobinMatchups = (teams) => {
  const matchups = [];
  let matchNumber = 1;
  
  // Generate all possible team vs team matchups
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const team1 = teams[i];
      const team2 = teams[j];
      
      // For each team matchup, create 5 individual player matches
      for (let playerIndex = 0; playerIndex < 5; playerIndex++) {
        const player1 = team1.members[playerIndex];
        const player2 = team2.members[playerIndex];
        
        matchups.push({
          round: 1, // Round robin is typically considered one round with multiple matches
          team1Id: team1.teamId,
          team2Id: team2.teamId,
          team1Name: team1.teamName,
          team2Name: team2.teamName,
          matchNumber: matchNumber,
          playerMatchNumber: playerIndex + 1, // Which player from each team (1-5)
          player1Name: player1,
          player2Name: player2,
          completed: false,
          winner: null,
          matchupTime: null
        });
        
        matchNumber++;
      }
    }
  }
  
  return matchups;
};

  const viewRegistrations = async (tournament) => {
    try {
      // Get the latest tournament data
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (tournamentSnap.exists()) {
        const tournamentData = tournamentSnap.data();
        setCurrentApprovals({
          tournament: {
            id: tournament.id,
            name: tournament.name,
            type: tournament.type
          },
          pendingRegistrations: tournamentData.pendingRegistrations || [],
          approvedRegistrations: tournamentData.approvedRegistrations || []
        });
        setApprovalsModalVisible(true);
      }
    } catch (error) {
      console.error("Error fetching registrations:", error);
      Alert.alert("Error", "Failed to fetch registrations");
    }
  };

  const approveRegistration = async (registration) => {
    if (!currentApprovals.tournament) return;
    
    try {
      const tournamentRef = doc(db, 'tournaments', currentApprovals.tournament.id);
      
      // Move registration from pending to approved
      await updateDoc(tournamentRef, {
        pendingRegistrations: arrayRemove(registration),
        approvedRegistrations: arrayUnion(registration)
      });
      
      Alert.alert("Success", "Registration approved");
      
      // Refresh approvals data
      const updatedTournamentSnap = await getDoc(tournamentRef);
      if (updatedTournamentSnap.exists()) {
        const updatedData = updatedTournamentSnap.data();
        setCurrentApprovals({
          ...currentApprovals,
          pendingRegistrations: updatedData.pendingRegistrations || [],
          approvedRegistrations: updatedData.approvedRegistrations || []
        });
      }
      
      fetchTournaments(); // Refresh tournament list
    } catch (error) {
      console.error("Error approving registration:", error);
      Alert.alert("Error", "Failed to approve registration");
    }
  };

  const rejectRegistration = async (registration) => {
    if (!currentApprovals.tournament) return;
    
    try {
      const tournamentRef = doc(db, 'tournaments', currentApprovals.tournament.id);
      
      // Remove registration from pending
      await updateDoc(tournamentRef, {
        pendingRegistrations: arrayRemove(registration)
      });
      
      Alert.alert("Success", "Registration rejected");
      
      // Refresh approvals data
      const updatedTournamentSnap = await getDoc(tournamentRef);
      if (updatedTournamentSnap.exists()) {
        const updatedData = updatedTournamentSnap.data();
        setCurrentApprovals({
          ...currentApprovals,
          pendingRegistrations: updatedData.pendingRegistrations || [],
          approvedRegistrations: updatedData.approvedRegistrations || []
        });
      }
      
      fetchTournaments(); // Refresh tournament list
    } catch (error) {
      console.error("Error rejecting registration:", error);
      Alert.alert("Error", "Failed to reject registration");
    }
  };

  // Update the renderTournamentItem function to show different UI for admin vs user

const renderTournamentItem = ({ item }) => {
  // Check user registration status
  const pendingRegistration = item.pendingRegistrations?.find(reg => reg.userId === user?.uid);
  const approvedRegistration = item.approvedRegistrations?.find(reg => reg.userId === user?.uid);
  
  // NEW: Check if user is part of any team that has registered for this tournament
  const sanitizedEmail = user?.email?.replace(/[@.]/g, '_');
  
  // Check pending registrations for teams containing this user
  const teamPendingRegistration = item.pendingRegistrations?.find(reg => 
    reg.type === 'team' && reg.members && reg.members.includes(sanitizedEmail)
  );
  
  // Check approved registrations for teams containing this user
  const teamApprovedRegistration = item.approvedRegistrations?.find(reg => 
    reg.type === 'team' && reg.members && reg.members.includes(sanitizedEmail)
  );
  
  // Determine final registration status
  const userRegistered = pendingRegistration || approvedRegistration || teamPendingRegistration || teamApprovedRegistration;
  
  let registrationStatus = 'none'; // none, pending, approved
  if (approvedRegistration || teamApprovedRegistration) {
    registrationStatus = 'approved';
  } else if (pendingRegistration || teamPendingRegistration) {
    registrationStatus = 'pending';
  }
  
  // Get the team name if user is registered via team
  const teamName = teamPendingRegistration?.teamName || teamApprovedRegistration?.teamName;
  
  return (
    <View style={styles.tournamentItem}>
      <View style={styles.tournamentHeader}>
        <Text style={styles.tournamentName}>{item.name}</Text>
        <View style={styles.tournamentType}>
          <Text style={styles.tournamentTypeText}>
            {item.type === 'roundrobin' ? 'Round Robin' : 'Elimination'}
          </Text>
        </View>
      </View>
      
      <View style={styles.tournamentDetails}>
        <Text style={styles.tournamentInfoText}>
          Status: <Text style={styles.statusUnstarted}>Unstarted</Text>
        </Text>
        
        {/* Show different information based on role */}
        {isAdmin ? (
          <View>
            <Text style={styles.tournamentInfoText}>
              Approved: {item.approvedRegistrations?.length || 0} participants
            </Text>
            <Text style={styles.tournamentInfoText}>
              Pending: {item.pendingRegistrations?.length || 0} participants
            </Text>
            <Text style={styles.tournamentInfoText}>
              Type: {item.type === 'roundrobin' ? 'Team-based (5 players per team)' : 'Individual players'}
            </Text>
          </View>
        ) : (
          <Text style={styles.tournamentInfoText}>
            Participants: {item.approvedRegistrations?.length || 0}
          </Text>
        )}
      </View>
      
      <View style={styles.buttonRow}>
        {/* Admin view - only show management options */}
        {isAdmin ? (
          <>
            <TouchableOpacity 
              style={[styles.adminButton, (item.pendingRegistrations?.length || 0) > 0 && styles.pendingButton]}
              onPress={() => viewRegistrations(item)}
            >
              <Text style={styles.adminButtonText}>
                Manage Registrations
                {(item.pendingRegistrations?.length || 0) > 0 && ` (${item.pendingRegistrations.length})`}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.startButton,
                (!item.approvedRegistrations || item.approvedRegistrations.length < 2) && styles.disabledButton
              ]}
              onPress={() => handleStartTournament(item)}
              disabled={!item.approvedRegistrations || item.approvedRegistrations.length < 2}
            >
              <Text style={styles.startButtonText}>Start Tournament</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* User view - show different statuses based on registration state */
          <View style={styles.userRegistrationContainer}>
            {registrationStatus === 'none' ? (
              <TouchableOpacity 
                style={styles.registerButton}
                onPress={() => {
                  setSelectedTournament(item);
                  setRegistrationModalVisible(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.registerButtonText}>Register</Text>
              </TouchableOpacity>
            ) : registrationStatus === 'pending' ? (
              <View style={styles.statusContainer}>
                <TouchableOpacity 
                  style={[styles.registerButton, styles.pendingStatusButton]}
                  disabled={true}
                >
                  <Ionicons name="time-outline" size={16} color="#f57c00" style={styles.buttonIcon} />
                  <Text style={styles.pendingStatusText}>
                    {teamName ? `Team "${teamName}" Pending Approval` : 'Pending Approval'}
                  </Text>
                </TouchableOpacity>
                
                {/* Show team info if registered via team */}
                {teamName && (
                  <View style={styles.teamInfoContainer}>
                    <Text style={styles.teamInfoText}>
                      📋 You are registered as part of team "{teamName}". 
                      Wait for admin approval or team captain to make changes.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.statusContainer}>
                <TouchableOpacity 
                  style={[styles.registerButton, styles.approvedStatusButton]}
                  disabled={true}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.buttonIcon} />
                  <Text style={styles.approvedStatusText}>
                    {teamName ? `Team "${teamName}" Accepted` : 'Registration Accepted'}
                  </Text>
                </TouchableOpacity>
                
                {/* Show additional info for approved users */}
                <View style={styles.approvedInfoContainer}>
                  <Text style={styles.approvedInfoText}>
                    🎉 {teamName ? `Your team "${teamName}" is registered!` : 'You\'re registered!'} 
                    Tournament will start when minimum participants are reached.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

  const renderRegistrationModal = () => {
    if (!selectedTournament) return null;
    
    return (
      <Modal
        visible={registrationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRegistrationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setRegistrationModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Register for Tournament</Text>
            <Text style={styles.modalTournamentName}>{selectedTournament.name}</Text>
            <Text style={styles.modalTournamentType}>
              Type: {selectedTournament.type === 'roundrobin' ? 'Round Robin' : 'Elimination'}
            </Text>
            
            {selectedTournament.type === 'roundrobin' ? (
              <>
                <Text style={styles.modalInfoText}>
                  Round Robin tournaments require a team with exactly 5 players.
                </Text>
                
                <Text style={styles.modalSectionTitle}>Select Team:</Text>
                
                {userTeams.length > 0 ? (
                  <FlatList
                    data={userTeams}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.teamSelectItem,
                          selectedTeam?.id === item.id && styles.selectedTeamItem,
                          !item.valid && styles.invalidTeamItem
                        ]}
                        onPress={() => item.valid && setSelectedTeam(item)}
                        disabled={!item.valid}
                      >
                        <View style={styles.teamSelectHeader}>
                          <Text style={styles.teamSelectName}>{item.name}</Text>
                          {selectedTeam?.id === item.id && (
                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                          )}
                        </View>
                        <Text style={styles.teamMemberCount}>
                          {item.members?.length || 0} / 5 members
                          {!item.valid && ' (5 members required)'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    style={styles.teamsList}
                  />
                ) : (
                  <View style={styles.noTeamsContainer}>
                    <Text style={styles.noTeamsText}>
                      You don't have any teams. Please create a team first.
                    </Text>
                    <TouchableOpacity
                      style={styles.createTeamButton}
                      onPress={() => {
                        setRegistrationModalVisible(false);
                        navigation.navigate('TeamScreen');
                      }}
                    >
                      <Text style={styles.createTeamButtonText}>Create Team</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.modalInfoText}>
                You are registering as an individual player for this Elimination tournament.
              </Text>
            )}
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRegistrationModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalRegisterButton,
                  selectedTournament.type === 'roundrobin' && !selectedTeam?.valid && styles.disabledButton
                ]}
                onPress={registerForTournament}
                disabled={selectedTournament.type === 'roundrobin' && !selectedTeam?.valid}
              >
                <Text style={styles.modalRegisterButtonText}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderApprovalsModal = () => {
    if (!currentApprovals.tournament) return null;
    
    return (
      <Modal
        visible={approvalsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setApprovalsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setApprovalsModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Tournament Registrations</Text>
            <Text style={styles.modalTournamentName}>{currentApprovals.tournament.name}</Text>
            
            {/* Pending Registrations Section */}
            <Text style={styles.approvalSectionTitle}>Pending Registrations</Text>
            {currentApprovals.pendingRegistrations.length > 0 ? (
              <FlatList
                data={currentApprovals.pendingRegistrations}
                keyExtractor={(_, index) => `pending-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.registrationItem}>
                    <View style={styles.registrationInfo}>
                      <Text style={styles.registrationName}>{item.userName}</Text>
                      <Text style={styles.registrationType}>
                        {item.type === 'team' ? 
                          `Team: ${item.teamName} (${item.members?.length || 0} players)` : 
                          'Individual Player'}
                      </Text>
                      <Text style={styles.registrationDate}>
                        {(() => {
                          // Handle different date formats safely
                          if (item.timestamp) {
                            try {
                              // If it's a Firestore timestamp
                              if (item.timestamp.toDate && typeof item.timestamp.toDate === 'function') {
                                return item.timestamp.toDate().toLocaleString();
                              }
                              // If it's already a Date object
                              if (item.timestamp instanceof Date) {
                                return item.timestamp.toLocaleString();
                              }
                              // If it's a string or number, try to convert
                              const date = new Date(item.timestamp);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleString();
                              }
                            } catch (error) {
                              console.error('Error formatting date:', error);
                            }
                          }
                          return 'Registration date unknown';
                        })()}
                      </Text>
                    </View>
                    
                    <View style={styles.registrationActions}>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => approveRegistration(item)}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => rejectRegistration(item)}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                style={styles.registrationsList}
              />
            ) : (
              <Text style={styles.emptyListText}>No pending registrations</Text>
            )}
            
            {/* Approved Registrations Section */}
            <Text style={styles.approvalSectionTitle}>Approved Registrations</Text>
            {currentApprovals.approvedRegistrations.length > 0 ? (
              <FlatList
                data={currentApprovals.approvedRegistrations}
                keyExtractor={(_, index) => `approved-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.approvedItem}>
                    <View style={styles.registrationInfo}>
                      <Text style={styles.registrationName}>{item.userName}</Text>
                      <Text style={styles.registrationType}>
                        {item.type === 'team' ? 
                          `Team: ${item.teamName} (${item.members?.length || 0} players)` : 
                          'Individual Player'}
                      </Text>
                      <Text style={styles.registrationDate}>
                        {(() => {
                          // Handle different date formats safely
                          if (item.timestamp) {
                            try {
                              // If it's a Firestore timestamp
                              if (item.timestamp.toDate && typeof item.timestamp.toDate === 'function') {
                                return item.timestamp.toDate().toLocaleString();
                              }
                              // If it's already a Date object
                              if (item.timestamp instanceof Date) {
                                return item.timestamp.toLocaleString();
                              }
                              // If it's a string or number, try to convert
                              const date = new Date(item.timestamp);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleString();
                              }
                            } catch (error) {
                              console.error('Error formatting date:', error);
                            }
                          }
                          return 'Registration date unknown';
                        })()}
                      </Text>
                    </View>
                    
                    <View style={styles.approvedBadge}>
                      <Text style={styles.approvedText}>Approved</Text>
                    </View>
                  </View>
                )}
                style={styles.registrationsList}
              />
            ) : (
              <Text style={styles.emptyListText}>No approved registrations</Text>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading tournaments...</Text>
        </View>
      </SafeAreaView>
    );
  }

 return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>
        {isAdmin ? 'Tournament Management' : 'Tournament Registration'}
      </Text>
      <Text style={styles.subtitle}>
        {isAdmin ? 
          'Manage tournament registrations and start tournaments' : 
          'Register for available tournaments'}
      </Text>
      
      {/* Show user registration summary */}
      {!isAdmin && (
        <View style={styles.userSummary}>
          {(() => {
            const userPending = tournaments.filter(t => 
              t.pendingRegistrations?.some(reg => reg.userId === user?.uid)
            ).length;
            const userApproved = tournaments.filter(t => 
              t.approvedRegistrations?.some(reg => reg.userId === user?.uid)
            ).length;
            
            if (userPending > 0 || userApproved > 0) {
              return (
                <Text style={styles.userSummaryText}>
                  Your registrations: {userApproved} accepted, {userPending} pending
                </Text>
              );
            }
            return null;
          })()}
        </View>
      )}
    </View>
      
      {/* Admin-only quick actions */}
      {isAdmin && (
        <View style={styles.adminActions}>
          <TouchableOpacity
            style={styles.createTournamentButton}
            onPress={() => navigation.navigate('CreateTourScreen')}
          >
            <Ionicons name="add-circle" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.createTournamentButtonText}>Create Tournament</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {tournaments.length > 0 ? (
        <FlatList
          data={tournaments}
          renderItem={renderTournamentItem}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={60} color="#bdbdbd" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>
            {isAdmin 
              ? 'No tournaments available. Create a new tournament to get started.' 
              : 'No tournaments available for registration at this time.'}
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.createTournamentButton}
              onPress={() => navigation.navigate('CreateTourScreen')}
            >
              <Ionicons name="add-circle" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.createTournamentButtonText}>Create Tournament</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Only render registration modal for regular users */}
      {!isAdmin && renderRegistrationModal()}
      
      {/* Only render approvals modal for admins */}
      {isAdmin && renderApprovalsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  tournamentItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  tournamentType: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
  },
  tournamentTypeText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  tournamentDetails: {
    marginBottom: 12,
  },
  tournamentInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusUnstarted: {
    fontWeight: '500',
    color: '#f57c00',
  },
  pendingCount: {
    color: '#f44336',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  registerButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
  },
  registerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  adminButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  createTournamentButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
  },
  createTournamentButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 8,
    padding: 20,
    elevation: 5,
  },
  modalClose: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalTournamentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 4,
  },
  modalTournamentType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  teamsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  teamSelectItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  selectedTeamItem: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#1976d2',
  },
  invalidTeamItem: {
    opacity: 0.6,
    borderLeftColor: '#BDBDBD',
  },
  teamSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teamMemberCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  noTeamsContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noTeamsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  createTeamButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  createTeamButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  modalCancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  modalRegisterButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
  },
  modalRegisterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  approvalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
  },
  registrationsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  registrationItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  registrationInfo: {
    marginBottom: 8,
  },
  registrationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  registrationType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  registrationDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  registrationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 8,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  approvedItem: {
    backgroundColor: '#f1f8e9',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approvedBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  approvedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyListText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  // Add these to your existing styles:
adminActions: {
  padding: 12,
  backgroundColor: '#f5f5f5',
  borderBottomWidth: 1,
  borderBottomColor: '#e0e0e0',
  flexDirection: 'row',
  justifyContent: 'flex-end',
},
buttonIcon: {
  marginRight: 6,
},
statusIcon: {
  marginRight: 4,
},
emptyIcon: {
  marginBottom: 16,
},
registrationStatus: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 8,
},
pendingRegistrationText: {
  color: '#f57c00',
  fontSize: 14,
  fontStyle: 'italic',
},
pendingButton: {
  backgroundColor: '#FF9800', // Orange color to indicate pending items
  borderWidth: 2,
  borderColor: '#F57C00',
},
userRegistrationContainer: {
  flex: 1,
},
statusContainer: {
  flex: 1,
},
pendingStatusButton: {
  backgroundColor: '#fff3cd',
  borderColor: '#f57c00',
  borderWidth: 1,
},
pendingStatusText: {
  color: '#f57c00',
  fontWeight: '600',
  fontSize: 14,
},
approvedStatusButton: {
  backgroundColor: '#d4edda',
  borderColor: '#4CAF50',
  borderWidth: 1,
},
approvedStatusText: {
  color: '#4CAF50',
  fontWeight: '600',
  fontSize: 14,
},
approvedInfoContainer: {
  marginTop: 8,
  padding: 8,
  backgroundColor: '#e8f5e8',
  borderRadius: 4,
  borderLeftWidth: 3,
  borderLeftColor: '#4CAF50',
},
approvedInfoText: {
  fontSize: 12,
  color: '#2e7d32',
  fontStyle: 'italic',
  textAlign: 'center',
},
userSummary: {
  marginTop: 8,
  padding: 8,
  backgroundColor: '#e3f2fd',
  borderRadius: 4,
  borderLeftWidth: 3,
  borderLeftColor: '#2196F3',
},
userSummaryText: {
  fontSize: 14,
  color: '#1976d2',
  fontWeight: '500',
},

teamInfoContainer: {
  marginTop: 8,
  padding: 10,
  backgroundColor: '#fff3cd',
  borderRadius: 4,
  borderLeftWidth: 3,
  borderLeftColor: '#f57c00',
},
teamInfoText: {
  fontSize: 12,
  color: '#856404',
  fontStyle: 'italic',
  textAlign: 'center',
  lineHeight: 16,
},
});

export default TourRegisterScreen;