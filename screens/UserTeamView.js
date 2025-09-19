import React, { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc,
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

function UserTeamView() {
  const navigation = useNavigation();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('view');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);

  useEffect(() => {
    fetchTeams();
    fetchAvailableUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Query teams collection
      const teamsRef = collection(db, 'teams');
      const teamSnapshot = await getDocs(teamsRef);
      
      // Get all teams
      const teamsList = await Promise.all(teamSnapshot.docs.map(async (teamDoc) => {
        const teamData = {
          id: teamDoc.id,
          ...teamDoc.data(),
          members: []
        };
        
        // For each team, get member details
        if (teamData.memberIds && teamData.memberIds.length > 0) {
          // Query all members of this team
          const memberPromises = teamData.memberIds.map(async (memberId) => {
            const memberDoc = doc(db, 'users', memberId);
            const memberSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', memberId)));
            
            if (!memberSnap.empty) {
              const userData = memberSnap.docs[0].data();
              return {
                id: memberId,
                email: memberId,
                ...userData
              };
            }
            return null;
          });
          
          const members = await Promise.all(memberPromises);
          teamData.members = members.filter(member => member !== null);
        }
        
        return teamData;
      }));
      
      setTeams(teamsList);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const userSnapshot = await getDocs(usersRef);
      
      const usersList = userSnapshot.docs.map(doc => {
        return {
          id: doc.id,
          email: doc.data().email || doc.id,
          name: doc.data().name || doc.data().email || doc.id,
          teamId: doc.data().teamId || null
        };
      });
      
      setAvailableUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const createTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name.');
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user.');
      return;
    }

    try {
      setLoading(true);
      
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

      // Reset form and refresh data
      setTeamName('');
      setSelectedUsers([]);
      setShowCreateTeam(false);
      setActiveTab('view');
      fetchTeams();
      fetchAvailableUsers();
      
    } catch (error) {
      console.error('Error creating team:', error);
      Alert.alert('Error', 'Failed to create team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (user) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Render team item for the Teams view
  const renderTeamItem = ({ item }) => {
    return (
      <View style={styles.teamItem}>
        <Text style={styles.teamName}>{item.name}</Text>
        <Text style={styles.teamMemberCount}>
          {item.members.length} member{item.members.length !== 1 ? 's' : ''}
        </Text>
        
        {item.members.map((member) => (
          <View key={member.id} style={styles.teamMemberItem}>
            <Text style={styles.teamMemberText}>{member.email}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Update the return statement to change the order of components
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team List</Text>
        <Text style={styles.subtitle}>
          {teams.length} team{teams.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'create' && styles.activeTabButton]}
          onPress={() => {
            setActiveTab('create');
            setShowCreateTeam(true);
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'create' && styles.activeTabText]}>
            Create Team
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'view' && styles.activeTabButton]}
          onPress={() => {
            setActiveTab('view');
            setShowCreateTeam(false);
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'view' && styles.activeTabText]}>
            View Teams
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Create Team Form - Show immediately after tabs when active */}
      {showCreateTeam && activeTab === 'create' && (
        <View style={styles.createTeamContainer}>
          <Text style={styles.sectionTitle}>Create New Team</Text>
          
          <Text style={styles.formLabel}>Team Name</Text>
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Enter team name"
            placeholderTextColor="#999"
          />
          
          <Text style={styles.formLabel}>Select Members ({selectedUsers.length} selected)</Text>
          
          {availableUsers.length > 0 ? (
            <FlatList
              data={availableUsers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedUsers.some(u => u.id === item.id);
                const isDisabled = item.teamId && !isSelected;
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.userItem,
                      isSelected && styles.selectedUserItem,
                      isDisabled && styles.disabledUser
                    ]}
                    onPress={() => !isDisabled && toggleUserSelection(item)}
                    disabled={isDisabled}
                  >
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name || item.email}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                      {item.teamId && <Text style={styles.userTeam}>Already in a team</Text>}
                    </View>
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              style={styles.usersList}
            />
          ) : (
            <Text style={styles.emptyText}>No available users found</Text>
          )}
          
          <View style={styles.formButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setShowCreateTeam(false);
                setTeamName('');
                setSelectedUsers([]);
                setActiveTab('view');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.submitButton, (!teamName.trim() || selectedUsers.length === 0) && styles.disabledButton]}
              onPress={createTeam}
              disabled={!teamName.trim() || selectedUsers.length === 0}
            >
              <Text style={styles.submitButtonText}>Create Team</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Teams List - Only show when viewing teams and not creating */}
      {activeTab === 'view' && (
        loading ? (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.centeredContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTeams}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          teams.length > 0 ? (
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={renderTeamItem}
              style={styles.list}
            />
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyText}>No teams have been created yet</Text>
              <TouchableOpacity 
                style={styles.createTeamButton}
                onPress={() => {
                  setActiveTab('create');
                  setShowCreateTeam(true);
                }}
              >
                <Text style={styles.createTeamButtonText}>Create a Team</Text>
              </TouchableOpacity>
            </View>
          )
        )
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
  list: {
    flex: 1,
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
  teamMemberCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  teamMemberItem: {
    backgroundColor: '#f0f4ff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  teamMemberText: {
    fontSize: 14,
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
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    paddingVertical: 30,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#2196F3',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#616161',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createTeamButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  createTeamButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createTeamContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  selectUsersTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  userList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedUser: {
    backgroundColor: '#d1e7dd',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  createTeamConfirmButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
  },
  userTeam: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
    fontStyle: 'italic',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  disabledUser: {
  opacity: 0.5,
  backgroundColor: '#f0f0f0',
  borderLeftWidth: 3,
  borderLeftColor: '#ccc'
},
disabledText: {
  color: '#999'
},
userTeam: {
  fontSize: 12,
  color: '#f44336',
  marginTop: 4,
  fontStyle: 'italic',
},
selectedUserItem: {
  backgroundColor: '#e3f2fd',
  borderWidth: 1,
  borderColor: '#2196F3',
},
selectedUserText: {
  color: '#0d47a1',
  fontWeight: '500',
},

});

export default UserTeamView;