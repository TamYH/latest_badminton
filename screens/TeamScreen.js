import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { db } from '../firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';

function TeamScreen({ route, navigation }) {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [mode, setMode] = useState('select-users');
  const [error, setError] = useState(null);
  const [syncIssues, setSyncIssues] = useState([]);
  const [tournamentName, setTournamentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);

  // Check if we're in tournament mode from CreateTourScreen
  const isTournamentMode = route.params?.tournamentMode === 'roundrobin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchTeams()]);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);

    let allUsers = userSnapshot.docs.map(doc => {
      return {
        id: doc.id,
        email: doc.data().email || doc.id,
        name: doc.data().name || doc.data().email || doc.id,
        teamId: doc.data().teamId || null
      };
    });

    setUsers(allUsers);
    return allUsers;
  };

  const fetchTeams = async () => {
    const teamsCollection = collection(db, 'teams');
    const teamSnapshot = await getDocs(teamsCollection);

    const teamsList = teamSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Team',
        memberIds: data.memberIds || [],
        members: [] // Will be populated later
      };
    });

    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnapshot.docs.forEach(doc => {
      usersMap[doc.id] = {
        id: doc.id,
        email: doc.data().email || doc.id,
        name: doc.data().name || doc.data().email || doc.id
      };
    });

    // Populate team members and identify sync issues
    const syncIssuesList = [];

    teamsList.forEach(team => {
      const members = [];
      const missingMembers = [];

      team.memberIds.forEach(memberId => {
        if (usersMap[memberId]) {
          members.push(usersMap[memberId]);
        } else {
          missingMembers.push(memberId);
        }
      });

      team.members = members;
      team.missingMembers = missingMembers;

      if (missingMembers.length > 0) {
        syncIssuesList.push({
          teamId: team.id,
          teamName: team.name,
          missingMembers: missingMembers
        });
      }
    });

    setTeams(teamsList);
    setSyncIssues(syncIssuesList);
    return teamsList;
  };

  const toggleUserSelection = (user) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      // For Round Robin mode, limit to 5 members per team
      if (isTournamentMode && selectedUsers.length >= 5) {
        Alert.alert('Team Size Limit', 'For Round Robin tournaments, teams must have exactly 5 members.');
        return;
      }
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const proceedToCreateTeam = () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user.');
      return;
    }

    // For Round Robin mode, require exactly 5 members
    if (isTournamentMode && selectedUsers.length !== 5) {
      Alert.alert('Invalid Team Size', 'For Round Robin tournaments, teams must have exactly 5 members.');
      return;
    }

    setMode('create-team');
  };

  const switchToViewTeams = () => {
    setMode('view-teams');
  };

  const switchToCreateTournament = () => {
    setMode('create-tournament');
  };

  const createTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name.');
      return;
    }

    try {
      const teamData = {
        name: teamName,
        memberIds: selectedUsers.map(u => u.id),
        createdAt: serverTimestamp()
      };

      const teamRef = await addDoc(collection(db, 'teams'), teamData);

      // Update user documents to reference this team
      for (const user of selectedUsers) {
        await updateDoc(doc(db, 'users', user.id), {
          teamId: teamRef.id
        });
      }

      Alert.alert('Success', 'Team created successfully!');

      resetForm();
      await fetchData();
      setMode('view-teams');
    } catch (err) {
      console.error('Error creating team:', err);
      Alert.alert('Error', 'Failed to create team. Please try again.');
    }
  };

  const toggleTeamSelection = (team) => {
    if (selectedTeams.some(t => t.id === team.id)) {
      setSelectedTeams(selectedTeams.filter(t => t.id !== team.id));
    } else {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const createRoundRobinTournament = async () => {
  // Validate tournament name
  if (!tournamentName.trim()) {
    Alert.alert('Error', 'Please enter a tournament name.');
    return;
  }

  // Need at least 2 teams for a tournament
  if (selectedTeams.length < 2) {
    Alert.alert('Error', 'You need to select at least 2 teams to create a tournament.');
    return;
  }

  const invalidTeams = selectedTeams.filter(team => team.members.length !== 5);

  // Check if all teams have exactly 5 members
  if (invalidTeams.length > 0) {
    const teamList = invalidTeams.map(team => `- ${team.name} (${team.members.length} members)`).join('\n');
    Alert.alert('Invalid Teams', `The following teams don't have exactly 5 members:\n${teamList}\n\nAll teams must have exactly 5 members for Round Robin tournaments.`);
    return;
  }

  try {
    setSaving(true);

    // Create proper round robin schedule
    const teams = [...selectedTeams];
    const numTeams = teams.length;
    const isOdd = numTeams % 2 !== 0;
    
    // Add dummy team if odd number of teams
    if (isOdd) {
      teams.push({ id: 'bye', name: 'BYE', members: [] });
    }
    
    const totalTeams = teams.length;
    const numRounds = totalTeams - 1;
    
    const allMatchups = [];
    let matchIndex = 1;
    
    // Create round robin schedule using rotation algorithm
    for (let round = 1; round <= numRounds; round++) {
      // In each round, pair teams
      for (let i = 0; i < totalTeams / 2; i++) {
        let team1Index, team2Index;
        
        if (i === 0) {
          // First team is always fixed at position 0
          team1Index = 0;
          team2Index = totalTeams - 1;
        } else {
          team1Index = i;
          team2Index = totalTeams - 1 - i;
        }
        
        const team1 = teams[team1Index];
        const team2 = teams[team2Index];
        
        // Skip if either team is the BYE team
        if (team1.id === 'bye' || team2.id === 'bye') {
          continue;
        }
        
        // Create 5 individual matches for this team pairing in this round
        for (let matchNumber = 1; matchNumber <= 5; matchNumber++) {
          allMatchups.push({
            round: round, // This is the key fix - use the actual round number
            matchIndex: matchIndex++,
            team1Id: team1.id,
            team1Name: team1.name,
            team2Id: team2.id,
            team2Name: team2.name,
            matchNumber: matchNumber,
            completed: false,
            winner: null,
            matchupTime: '',
            // Add player info for individual matchups
            player1Name: team1.members[matchNumber-1]?.name || `Player ${matchNumber} (${team1.name})`,
            player1Id: team1.members[matchNumber-1]?.id || null,
            player2Name: team2.members[matchNumber-1]?.name || `Player ${matchNumber} (${team2.name})`,
            player2Id: team2.members[matchNumber-1]?.id || null
          });
        }
      }
      
      // Rotate teams for next round (keep first team fixed, rotate others)
      if (round < numRounds) {
        const temp = teams[1];
        for (let i = 1; i < totalTeams - 1; i++) {
          teams[i] = teams[i + 1];
        }
        teams[totalTeams - 1] = temp;
      }
    }

    // Create tournament in Firestore
    const tournamentRef = await addDoc(collection(db, 'tournaments'), {
      name: tournamentName,
      type: 'roundrobin',
      totalTeams: selectedTeams.length, // Use original team count (without BYE)
      matchups: allMatchups,
      currentRound: 1,
      completed: false,
      createdAt: serverTimestamp(),
      teams: selectedTeams.map(team => ({
        id: team.id,
        name: team.name,
        memberIds: team.memberIds
      }))
    });

    setSaving(false);
    Alert.alert(
      'Success',
      'Round Robin Tournament created successfully!',
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


  const resetForm = () => {
    setSelectedUsers([]);
    setTeamName('');
    setTournamentName('');
    setSelectedTeams([]);
  };

  const cleanupTeam = async (team) => {
    try {
      // Update users that reference this team
      for (const member of team.members) {
        await updateDoc(doc(db, 'users', member.id), {
          teamId: null
        });
      }

      // Clean up missing member IDs
      await updateDoc(doc(db, 'teams', team.id), {
        memberIds: team.members.map(m => m.id)
      });

      Alert.alert('Success', 'Team references fixed successfully!');
      await fetchData();
    } catch (err) {
      console.error('Error cleaning up team:', err);
      Alert.alert('Error', 'Failed to fix team references.');
    }
  };

  const deleteTeam = async (team) => {
    try {
      // First, update all users to remove team reference
      for (const member of team.members) {
        await updateDoc(doc(db, 'users', member.id), {
          teamId: null
        });
      }

      // Then delete the team
      await deleteDoc(doc(db, 'teams', team.id));

      Alert.alert('Success', 'Team deleted successfully!');
      await fetchData();
    } catch (err) {
      console.error('Error deleting team:', err);
      Alert.alert('Error', 'Failed to delete team.');
    }
  };

  // Render user item for the FlatList
  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.some(user => user.id === item.id);
    const isDisabled = item.teamId !== null && !isSelected;

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          isSelected && styles.selectedUser,
          isDisabled && styles.disabledUser
        ]}
        onPress={() => !isDisabled && toggleUserSelection(item)}
        disabled={isDisabled}
      >
        <View style={styles.userInfoContainer}>
          <Text style={[styles.userName, isDisabled && styles.disabledText]}>
            {item.name || item.email}
          </Text>
          <Text style={[styles.userEmail, isDisabled && styles.disabledText]}>
            {item.email}
          </Text>
          {item.teamId && (
            <Text style={styles.userTeam}>
              Already in a team
            </Text>
          )}
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render team item for the Teams view
  const renderTeamItem = ({ item }) => {
    return (
      <View style={styles.teamItem}>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamName}>{item.name}</Text>
          <Text style={styles.teamMemberCount}>
            {item.members.length} member{item.members.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {item.members.map((member) => (
          <View key={member.id} style={styles.teamMemberItem}>
            <Text style={styles.teamMemberName}>{member.name || member.email}</Text>
            <Text style={styles.teamMemberEmail}>{member.email}</Text>
          </View>
        ))}

        {item.missingMembers && item.missingMembers.length > 0 && (
          <>
            <Text style={styles.missingMembersTitle}>
              Missing Members ({item.missingMembers.length})
            </Text>
            {item.missingMembers.map((memberId, index) => (
              <View key={index} style={styles.missingMemberItem}>
                <Text style={styles.missingMemberText}>
                  Missing User ID: {memberId}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.fixButton}
              onPress={() => cleanupTeam(item)}
            >
              <Text style={styles.fixButtonText}>Fix References</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Confirm Deletion',
              `Are you sure you want to delete the team "${item.name}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTeam(item) }
              ]
            );
          }}
        >
          <Text style={styles.deleteButtonText}>Delete Team</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render sync issues banner if present
  const renderSyncIssuesBanner = () => {
    if (syncIssues.length === 0) return null;

    return (
      <View style={styles.syncIssuesBanner}>
        <Text style={styles.syncIssuesText}>
          {syncIssues.length} team{syncIssues.length !== 1 ? 's' : ''} with reference issues detected.
          Please check teams for missing members.
        </Text>
      </View>
    );
  };

  // Show loading indicator
  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show saving indicator
  if (saving) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Creating tournament...</Text>
      </View>
    );
  }

  // Show error message
  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchData}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Select Users mode
  if (mode === 'select-users') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isTournamentMode ? 'Create Round Robin Team' : 'Create Team'}
          </Text>
          <Text style={styles.subtitle}>
            {isTournamentMode
              ? 'Select exactly 5 members for your team'
              : 'Select members for team'
            }
          </Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === 'select-users' && styles.activeTab]}
            onPress={() => setMode('select-users')}
          >
            <Text style={[styles.tabText, mode === 'select-users' && styles.activeTabText]}>
              Create Team
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'view-teams' && styles.activeTab]}
            onPress={switchToViewTeams}
          >
            <Text style={[styles.tabText, mode === 'view-teams' && styles.activeTabText]}>
              View Teams
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'create-tournament' && styles.activeTab]}
            onPress={switchToCreateTournament}
          >
            <Text style={[styles.tabText, mode === 'create-tournament' && styles.activeTabText]}>
              Create Tournament
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.usersContainer}>
          <Text style={styles.sectionTitle}>
            Select Users ({selectedUsers.length} selected
            {isTournamentMode && ' / 5 required'})
          </Text>

          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
          />
        </View>

        <View style={styles.buttonContainer}>
          {isTournamentMode && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              selectedUsers.length === 0 && styles.buttonDisabled,
              isTournamentMode && selectedUsers.length !== 5 && styles.buttonDisabled
            ]}
            onPress={proceedToCreateTeam}
            disabled={selectedUsers.length === 0 || (isTournamentMode && selectedUsers.length !== 5)}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Create Team mode
  if (mode === 'create-team') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Name Your Team</Text>
          <Text style={styles.subtitle}>
            {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected
          </Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Team Name</Text>
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Enter team name"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Selected Members</Text>
          <FlatList
            data={selectedUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.selectedUserItem}>
                <Text style={styles.selectedUserName}>{item.name || item.email}</Text>
                <Text style={styles.selectedUserEmail}>{item.email}</Text>
              </View>
            )}
            style={styles.selectedList}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setMode('select-users')}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !teamName.trim() && styles.buttonDisabled]}
            onPress={createTeam}
            disabled={!teamName.trim()}
          >
            <Text style={styles.buttonText}>Create Team</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Create Tournament mode
  if (mode === 'create-tournament') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Round Robin Tournament</Text>
          <Text style={styles.subtitle}>
            Create a tournament with existing teams
          </Text>
        </View>


        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === 'select-users' && styles.activeTab]}
            onPress={() => setMode('select-users')}
          >
            <Text style={[styles.tabText, mode === 'select-users' && styles.activeTabText]}>
              Create Team
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'view-teams' && styles.activeTab]}
            onPress={switchToViewTeams}
          >
            <Text style={[styles.tabText, mode === 'view-teams' && styles.activeTabText]}>
              View Teams
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'create-tournament' && styles.activeTab]}
            onPress={() => setMode('create-tournament')}
          >
            <Text style={[styles.tabText, mode === 'create-tournament' && styles.activeTabText]}>
              Create Tournament
            </Text>
          </TouchableOpacity>
        </View>


        <View style={styles.formContainer}>
          <Text style={styles.label}>Tournament Name</Text>
          <TextInput
            style={styles.input}
            value={tournamentName}
            onChangeText={setTournamentName}
            placeholder="Enter tournament name"
            placeholderTextColor="#999"
          />


          <Text style={styles.label}>
            Select Teams for Tournament ({selectedTeams.length} selected)
          </Text>
          <Text style={styles.infoText}>
            All teams must have exactly 5 members for Round Robin tournaments.
            Minimum 2 teams required to create a tournament.
            {teams.length === 0 && ' You need to create teams first before creating a tournament.'}
          </Text>


          {teams.length > 0 ? (
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.tournamentTeamItem,
                    item.members.length !== 5 && styles.invalidTeamItem,
                    selectedTeams.some(t => t.id === item.id) && styles.selectedTeamItem
                  ]}
                  onPress={() => item.members.length === 5 && toggleTeamSelection(item)}
                  disabled={item.members.length !== 5}
                >
                  <Text style={styles.tournamentTeamName}>{item.name}</Text>
                  <View style={styles.tournamentTeamMembersRow}>
                    <Text style={styles.tournamentTeamMemberCount}>
                      {item.members.length} member{item.members.length !== 1 ? 's' : ''}
                    </Text>
                    {selectedTeams.some(t => t.id === item.id) && (
                      <Text style={styles.selectedText}>✓ Selected</Text>
                    )}
                    {item.members.length !== 5 && (
                      <Text style={styles.invalidTeamText}>
                        Need exactly 5 members
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              style={styles.selectedList}
            />
          ) : (
            <View style={styles.emptyTeamsContainer}>
              <Text style={styles.emptyText}>No teams created yet</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setMode('select-users')}
              >
                <Text style={styles.buttonText}>Create Team First</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>


        {teams.length > 0 && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                (!tournamentName.trim() || selectedTeams.length < 2) && styles.buttonDisabled
              ]}
              onPress={createRoundRobinTournament}
              disabled={!tournamentName.trim() || selectedTeams.length < 2}
            >
              <Text style={styles.buttonText}>
                Create Tournament ({selectedTeams.length} teams)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }


  // View Teams mode
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team List</Text>
        <Text style={styles.subtitle}>
          {teams.length} team{teams.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, mode === 'select-users' && styles.activeTab]}
          onPress={() => setMode('select-users')}
        >
          <Text style={[styles.tabText, mode === 'select-users' && styles.activeTabText]}>
            Create Team
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'view-teams' && styles.activeTab]}
          onPress={switchToViewTeams}
        >
          <Text style={[styles.tabText, mode === 'view-teams' && styles.activeTabText]}>
            View Teams
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'create-tournament' && styles.activeTab]}
          onPress={switchToCreateTournament}
        >
          <Text style={[styles.tabText, mode === 'create-tournament' && styles.activeTabText]}>
            Create Tournament
          </Text>
        </TouchableOpacity>
      </View>

      {renderSyncIssuesBanner()}

      {teams.length > 0 ? (
        <FlatList
          data={teams}
          renderItem={renderTeamItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      ) : (
        <Text style={styles.emptyText}>No teams have been created yet</Text>
      )}

      {isTournamentMode && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#616161',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    color: '#333',
  },
  usersContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
    marginBottom: 16,
  },
  userItem: {
    backgroundColor: '#fff',
    padding: 16,
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
  selectedUser: {
    backgroundColor: '#e0f7fa',
    borderColor: '#00b0ff',
    borderWidth: 1,
  },
  disabledUser: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  disabledText: {
    color: '#888',
  },
  userTeam: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00b0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2196F3',
    flex: 0.4,
  },
  secondaryButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedList: {
    maxHeight: 200,
    marginTop: 10,
  },
  selectedUserItem: {
    backgroundColor: '#e1f5fe',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedUserName: {
    fontSize: 15,
    fontWeight: '500',
  },
  selectedUserEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  teamItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamMemberCount: {
    fontSize: 14,
    color: '#666',
  },
  teamMemberItem: {
    backgroundColor: '#f0f4ff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  teamMemberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  teamMemberEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  missingMembersTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    color: '#f44336',
  },
  missingMemberItem: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
  },
  missingMemberText: {
    fontSize: 14,
    color: '#f44336',
    fontStyle: 'italic',
  },
  warningContainer: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  warningText: {
    color: '#e65100',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  fixButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  fixButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  syncIssuesBanner: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  syncIssuesText: {
    color: '#d32f2f',
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    paddingVertical: 16,
  },
  emptyTeamsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  tournamentTeamItem: {
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  invalidTeamItem: {
    backgroundColor: '#fff5f5',
    borderLeftColor: '#f44336',
  },
  tournamentTeamName: {
    fontSize: 16,
    fontWeight: '500',
  },
  tournamentTeamMembersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tournamentTeamMemberCount: {
    fontSize: 14,
    color: '#666',
  },
  invalidTeamText: {
    fontSize: 13,
    color: '#f44336',
    fontWeight: '500',
  },

  selectedTeamItem: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#4caf50',
  },
  selectedText: {
    fontSize: 13,
    color: '#4caf50',
    fontWeight: '500',
  },

});

export default TeamScreen;
