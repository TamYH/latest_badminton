import React, { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { auth, db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

function TeamScreen() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [mode, setMode] = useState('select-users'); // 'select-users', 'create-team', or 'view-teams'
  const [error, setError] = useState(null);
  const [syncIssues, setSyncIssues] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncIssues([]);
      
      await Promise.all([fetchUsers(), fetchTeams()]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    // Query users collection
    const usersRef = collection(db, 'users');
    const userSnapshot = await getDocs(usersRef);
    
    // Map documents to array of user objects
    const usersList = userSnapshot.docs.map(doc => {
      const userData = doc.data();
      return {
        id: doc.id,
        email: doc.id, // Document ID is still the email
        username: userData.username || doc.id, // Use username if available, fallback to email
        ...userData
      };
    });
    
    setUsers(usersList);
    return usersList; // Return the users list for use in fetchTeams
  };

  const fetchTeams = async () => {
    const issues = [];
    
    // Query teams collection
    const teamsRef = collection(db, 'teams');
    const teamSnapshot = await getDocs(teamsRef);
    
    // Get all teams
    const teamsList = await Promise.all(teamSnapshot.docs.map(async (teamDoc) => {
      const teamData = {
        id: teamDoc.id,
        ...teamDoc.data(),
        members: [],
        missingMembers: [] // Track missing member IDs
      };
      
      // For each team, get member details
      if (teamData.memberIds && teamData.memberIds.length > 0) {
        // Query all members of this team
        const memberPromises = teamData.memberIds.map(async (memberId) => {
          try {
            // Try to fetch the user document directly
            const memberDocRef = doc(db, 'users', memberId);
            const memberDocSnap = await getDoc(memberDocRef);
            
            if (memberDocSnap.exists()) {
              // User exists
              const userData = memberDocSnap.data();
              return {
                id: memberId,
                email: memberId,
                ...userData
              };
            } else {
              // User doesn't exist
              teamData.missingMembers.push(memberId);
              issues.push({
                type: 'missing-user',
                teamId: teamDoc.id,
                teamName: teamData.name,
                userId: memberId
              });
              return null;
            }
          } catch (err) {
            console.error(`Error fetching team member ${memberId}:`, err);
            return null;
          }
        });
        
        const members = await Promise.all(memberPromises);
        teamData.members = members.filter(member => member !== null);
      }
      
      return teamData;
    }));
    
    setTeams(teamsList);
    if (issues.length > 0) {
      setSyncIssues(issues);
    }
  };

  const toggleUserSelection = (user) => {
    // Don't allow selection if user already has a team
    if (user.teamId) {
      Alert.alert(
        'User Already in Team',
        `${user.email} is already assigned to team "${user.teamName}".`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (selectedUsers.some(u => u.id === user.id)) {
      // Remove user if already selected
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      // Add user to selected list
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const proceedToCreateTeam = () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user for the team');
      return;
    }
    setMode('create-team');
  };

  const switchToViewTeams = () => {
    setMode('view-teams');
  };

  const createTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }

    try {
      setLoading(true);
      
      // Create a new team document
      const teamData = {
        name: teamName,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.uid : null,
        memberIds: selectedUsers.map(user => user.id)
      };
      
      // Add team to teams collection
      const teamsRef = collection(db, 'teams');
      const newTeamRef = await addDoc(teamsRef, teamData);
      
      // Update each user with team reference
      const userPromises = selectedUsers.map(user => {
        const userRef = doc(db, 'users', user.id);
        return updateDoc(userRef, {
          teamId: newTeamRef.id,
          teamName: teamName
        });
      });
      
      await Promise.all(userPromises);
      
      Alert.alert(
        'Success', 
        `Team "${teamName}" created with ${selectedUsers.length} members`,
        [{ text: 'OK', onPress: resetForm }]
      );
      
      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedUsers([]);
    setTeamName('');
    setMode('select-users');
  };

  const cleanupTeam = async (team) => {
    try {
      setLoading(true);
      
      // Update the team document to remove missing members
      const teamRef = doc(db, 'teams', team.id);
      const validMemberIds = team.memberIds.filter(id => 
        !team.missingMembers.includes(id)
      );
      
      await updateDoc(teamRef, {
        memberIds: validMemberIds
      });
      
      Alert.alert(
        'Team Updated', 
        `Removed ${team.missingMembers.length} missing members from team "${team.name}"`,
        [{ text: 'OK' }]
      );
      
      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Error cleaning up team:', err);
      setError('Failed to update team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async (team) => {
    try {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete team "${team.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              
              // Update all existing team members to remove team reference
              const memberPromises = team.members.map(member => {
                const userRef = doc(db, 'users', member.id);
                return updateDoc(userRef, {
                  teamId: null,
                  teamName: null
                });
              });
              
              await Promise.all(memberPromises);
              
              // Delete the team document
              const teamRef = doc(db, 'teams', team.id);
              await deleteDoc(teamRef);
              
              Alert.alert(
                'Team Deleted', 
                `Successfully deleted team "${team.name}"`,
                [{ text: 'OK' }]
              );
              
              // Refresh data
              fetchData();
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error deleting team:', err);
      setError('Failed to delete team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render user item for the FlatList
  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.some(user => user.id === item.id);
    const isDisabled = !!item.teamId; // Disable if user already has a team
    
    return (
      <TouchableOpacity 
        style={[
          styles.userItem, 
          isSelected && styles.selectedUser,
          isDisabled && styles.disabledUser
        ]} 
        onPress={() => toggleUserSelection(item)}
        disabled={isDisabled}
      >
        <View style={styles.userInfoContainer}>
          <Text style={[styles.userName, isDisabled && styles.disabledText]}>
            {item.username}
          </Text>
          <Text style={styles.userEmail}>
            {item.email}
          </Text>
        </View>
        {item.teamName && (
          <Text style={styles.userTeam}>Team: {item.teamName}</Text>
        )}
        {isSelected && !isDisabled && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render team item for the Teams view
  const renderTeamItem = ({ item }) => {
    const hasMissingMembers = item.missingMembers && item.missingMembers.length > 0;
    
    return (
      <View style={styles.teamItem}>
        <Text style={styles.teamName}>{item.name}</Text>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamMemberCount}>
            {item.members.length} member{item.members.length !== 1 ? 's' : ''}
          </Text>
          
          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteTeam(item)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
        
        {hasMissingMembers && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              ⚠️ {item.missingMembers.length} missing member{item.missingMembers.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity 
              style={styles.fixButton}
              onPress={() => cleanupTeam(item)}
            >
              <Text style={styles.fixButtonText}>Fix</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {item.members.length > 0 ? (
          item.members.map((member) => (
            <View key={member.id} style={styles.teamMemberItem}>
              <Text style={styles.teamMemberName}>{member.username || member.email}</Text>
              {member.username && <Text style={styles.teamMemberEmail}>{member.email}</Text>}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No active members</Text>
        )}
        
        {hasMissingMembers && (
          <>
            <Text style={styles.missingMembersTitle}>Missing Members:</Text>
            {item.missingMembers.map((memberId) => (
              <View key={memberId} style={styles.missingMemberItem}>
                <Text style={styles.missingMemberText}>{memberId}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  // Render sync issues banner if present
  const renderSyncIssuesBanner = () => {
    if (syncIssues.length === 0) return null;
    
    return (
      <TouchableOpacity 
        style={styles.syncIssuesBanner}
        onPress={() => Alert.alert(
          'Sync Issues Detected',
          'Some teams reference users that no longer exist in the database. ' +
          'Go to the View Teams tab and use the "Fix" button to clean up teams.',
          [{ text: 'OK', onPress: () => setMode('view-teams') }]
        )}
      >
        <Text style={styles.syncIssuesText}>
          ⚠️ {syncIssues.length} sync issue{syncIssues.length !== 1 ? 's' : ''} detected
        </Text>
      </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Sync Issues Banner */}
      {renderSyncIssuesBanner()}
      
      {/* Navigation Tabs */}
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
      </View>

      {mode === 'select-users' && (
        // User Selection Mode
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Select Team Members</Text>
            <Text style={styles.subtitle}>
              Selected: {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          {users.length > 0 ? (
            <View style={styles.usersContainer}>
              <Text style={styles.sectionTitle}>Available Users:</Text>
              <FlatList
                data={users.filter(user => !user.teamId)}
                keyExtractor={(item) => item.id}
                renderItem={renderUserItem}
                style={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No available users found</Text>
                }
              />
              
              <Text style={styles.sectionTitle}>Users in Teams:</Text>
              <FlatList
                data={users.filter(user => user.teamId)}
                keyExtractor={(item) => item.id}
                renderItem={renderUserItem}
                style={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No users assigned to teams</Text>
                }
              />
            </View>
          ) : (
            <Text style={styles.emptyText}>No users found</Text>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, selectedUsers.length === 0 && styles.buttonDisabled]}
              onPress={proceedToCreateTeam}
              disabled={selectedUsers.length === 0}
            >
              <Text style={styles.buttonText}>Continue to Create Team</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      
      {mode === 'create-team' && (
        // Team Creation Mode
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Create Team</Text>
            <Text style={styles.subtitle}>
              {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.label}>Team Name</Text>
            <TextInput
              style={styles.input}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="Enter team name"
            />
            
            <Text style={styles.label}>Selected Members:</Text>
            <FlatList
              data={selectedUsers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.selectedUserItem}>
                  <Text style={styles.selectedUserName}>{item.username}</Text>
                  <Text style={styles.selectedUserEmail}>{item.email}</Text>
                </View>
              )}
              style={styles.selectedList}
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('select-users')}>
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
        </>
      )}
      
      {mode === 'view-teams' && (
        // View Teams Mode
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Team Lists</Text>
            <Text style={styles.subtitle}>
                {teams.length} team{teams.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          {teams.length > 0 ? (
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={renderTeamItem}
              style={styles.list}
            />
          ) : (
            <Text style={styles.emptyText}>No teams have been created yet</Text>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => setMode('select-users')}
            >
              <Text style={styles.buttonText}>Create New Team</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7f2eb',
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
    fontSize: 14,
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
  },
  fixButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
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
  }
});

export default TeamScreen;