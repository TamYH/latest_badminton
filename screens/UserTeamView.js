import React, { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc,
} from 'firebase/firestore';

function UserTeamView() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeams();
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchTeams}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team List</Text>
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
  }
});

export default UserTeamView;