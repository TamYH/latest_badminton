import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert, SafeAreaView } from 'react-native';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { TextInput } from 'react-native';

const { width } = Dimensions.get('window');

const TeamRollerWheel = ({ navigation }) => {
    const [teams, setTeams] = useState([]);
    const [spinning, setSpinning] = useState(false);
    const [selectedTeams, setSelectedTeams] = useState([]);
    const [matchups, setMatchups] = useState([]);
    const [rotation, setRotation] = useState(0);
    const [selectionCount, setSelectionCount] = useState(0);
    const [currentRound, setCurrentRound] = useState(1);
    const [tournamentSaved, setTournamentSaved] = useState(false);
    const [tournamentName, setTournamentName] = useState('');

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'teams'));
                const teamsList = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name || doc.id,
                        members: data.members || []
                    };
                });
                setTeams(teamsList);
            } catch (error) {
                console.log('Error fetching teams:', error);
            }
        };

        fetchTeams();
    }, []);

    const spinWheel = () => {
        if (spinning || remainingTeams.length === 0) return;

        // Handle last two teams case
        if (remainingTeams.length === 2) {
            setSpinning(true);
            const newSelectedTeams = [...selectedTeams, ...remainingTeams];
            setSelectedTeams(newSelectedTeams);

            const newMatchup = {
                id: `match-${currentRound}-${matchups.length + 1}`,
                team1: remainingTeams[0],
                team2: remainingTeams[1],
                round: currentRound
            };
            setMatchups([...matchups, newMatchup]);
            setSelectionCount(prev => prev + 2);
            setSpinning(false);
            return;
        }

        // Regular spin logic
        setSpinning(true);
        const newRotation = rotation + 1800 + Math.floor(Math.random() * 360);
        setRotation(newRotation);

        setTimeout(() => {
            const availableTeams = teams.filter(team =>
                !selectedTeams.some(selected => selected.id === team.id)
            );

            if (availableTeams.length > 0) {
                const selectedIndex = Math.floor((newRotation % 360) / (360 / availableTeams.length));
                const selectedTeam = availableTeams[selectedIndex];

                const updatedSelectedTeams = [...selectedTeams, selectedTeam];
                setSelectedTeams(updatedSelectedTeams);

                setSelectionCount(prev => prev + 1);

                if ((selectionCount + 1) % 2 === 0) {
                    const newMatchup = {
                        id: `match-${currentRound}-${matchups.length + 1}`,
                        team1: updatedSelectedTeams[updatedSelectedTeams.length - 2],
                        team2: selectedTeam,
                        round: currentRound
                    };
                    setMatchups(prev => [...prev, newMatchup]);
                }
            }

            setSpinning(false);
        }, 3000);
    };

    // Save tournament to Firestore
    const saveTournament = async () => {
        try {
            // Format matchups for Firestore
            const formattedMatchups = matchups.map(matchup => ({
                team1Id: matchup.team1.id,
                team1Name: matchup.team1.name,
                team2Id: matchup.team2.id,
                team2Name: matchup.team2.name,
                round: matchup.round,
                winner: null, // No winner initially
                completed: false
            }));

            // Create tournament document
            const tournamentRef = await addDoc(collection(db, 'tournaments'), {
                createdAt: serverTimestamp(),
                name: tournamentName.trim() !== '' ? tournamentName : `Tournament ${new Date().toLocaleDateString()}`,
                matchups: formattedMatchups,
                totalTeams: teams.length,
                currentRound: currentRound,
                completed: false
            });

            setTournamentSaved(true);
            Alert.alert(
                "Success",
                "Tournament saved successfully!",
                [
                    {
                        text: "View Tournament",
                        onPress: () => navigation.navigate('TournamentView', { tournamentId: tournamentRef.id })
                    },
                    { text: "OK" }
                ]
            );
        } catch (error) {
            console.error("Error saving tournament:", error);
            Alert.alert("Error", "Failed to save tournament. Please try again.");
        }
    };

    const remainingTeams = teams.filter(team =>
        !selectedTeams.some(selected => selected.id === team.id)
    );

    const allTeamsPaired = teams.length > 0 && remainingTeams.length === 0;

    return (
        
        <View style={styles.container}>
            <SafeAreaView>
            <Text style={styles.title}>Team Tournament Wheel</Text>

            {remainingTeams.length === 2 && (
                <View style={styles.lastTwoContainer}>
                    <Text style={styles.lastTwoText}>
                        Last two teams remaining! They will be paired automatically.
                    </Text>
                </View>
                
            )}

            <View style={styles.wheelContainer}>
                {remainingTeams.length > 0 ? (
                    <>
                        <View
                            style={[
                                styles.wheel,
                                { transform: [{ rotate: `${rotation}deg` }] }
                            ]}
                        >
                            {remainingTeams.map((team, index) => {
                                const angle = (index * 360) / remainingTeams.length;
                                return (
                                    <View
                                        key={team.id}
                                        style={[
                                            styles.segment,
                                            {
                                                transform: [{ rotate: `${angle}deg` }],
                                                backgroundColor: index % 2 === 0 ? '#4a90e2' : '#5cb85c'
                                            }
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                { transform: [{ rotate: `${90}deg` }] }
                                            ]}
                                        >
                                            {team.name}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={styles.pointer} />
                    </>
                ) : (
                    <View style={styles.emptyWheelContainer}>
                        <Text style={styles.emptyWheelText}>
                            {teams.length === 0 ? 'No teams available' : 'All teams selected'}
                        </Text>
                    </View>
                )}
            </View>
            </SafeAreaView>

            <TouchableOpacity
                style={[
                    styles.spinButton,
                    (spinning || remainingTeams.length === 0) && styles.spinningButton
                ]}
                onPress={spinWheel}
                disabled={spinning || remainingTeams.length === 0}
            >
                <Text style={styles.spinButtonText}>
                    {spinning ? 'Spinning...' :
                        remainingTeams.length === 0 ? 'Tournament Selection Complete' :
                            remainingTeams.length === 2 ? 'Pair Last Two Teams' : 'Spin the Wheel'}
                </Text>
            </TouchableOpacity>

            {remainingTeams.length === 0 && (
                <View style={styles.tournamentCompleteContainer}>
                    <Text style={styles.tournamentCompleteText}>
                        All Teams Have Been Paired!
                    </Text>

                    <TextInput
                        style={{
                            borderWidth: 1,
                            borderColor: '#ccc',
                            borderRadius: 8,
                            padding: 10,
                            width: '100%',
                            marginTop: 10,
                            backgroundColor: '#fff',
                        }}
                        placeholder="Enter Tournament Name"
                        value={tournamentName}
                        onChangeText={setTournamentName}
                    />
                    {!tournamentSaved ? (
                        <TouchableOpacity
                            style={styles.saveTournamentButton}
                            onPress={saveTournament}
                        >
                            <Text style={styles.saveTournamentButtonText}>Save Tournament</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.tournamentCompleteSubText}>
                            Tournament has been saved
                        </Text>
                    )}
                </View>
            )}

            {selectionCount % 2 === 1 && selectedTeams.length > 0 && (
                <View style={styles.selectedTeamContainer}>
                    <Text style={styles.selectedTeamText}>
                        Selected: {selectedTeams[selectedTeams.length - 1].name}
                    </Text>
                    <Text style={styles.nextTeamText}>
                        Waiting for opponent...
                    </Text>
                </View>
            )}

            <ScrollView style={styles.matchupList}>
                <Text style={styles.matchupListTitle}>Tournament Matchups</Text>
                {matchups.map(matchup => (
                    <View key={matchup.id} style={styles.matchupItem}>
                        <Text style={styles.matchupTitle}>Round {matchup.round} - Match {matchups.indexOf(matchup) + 1}</Text>
                        <View style={styles.teamsContainer}>
                            <Text style={styles.teamName}>{matchup.team1.name}</Text>
                            <Text style={styles.vsText}>vs</Text>
                            <Text style={styles.teamName}>{matchup.team2.name}</Text>
                        </View>
                    </View>
                ))}
                {matchups.length === 0 && (
                    <Text style={styles.noMatchupsText}>No matchups created yet</Text>
                )}
            </ScrollView>

            <View style={styles.statusContainer}>
                <Text style={styles.statusText}>
                    Remaining Teams: {remainingTeams.length}
                </Text>
                <Text style={styles.statusText}>
                    Current Round: {currentRound}
                </Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.resetButton, allTeamsPaired && styles.highlightedResetButton]}
                    onPress={() => {
                        setSelectedTeams([]);
                        setMatchups([]);
                        setSelectionCount(0);
                        setCurrentRound(1);
                        setRotation(0);
                        setTournamentSaved(false);
                    }}
                >
                    <Text style={styles.resetButtonText}>Reset Tournament</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.viewTournamentsButton}
                    onPress={() => navigation.navigate('TournamentView')}
                >
                    <Text style={styles.viewTournamentsButtonText}>View Tournaments</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backButtonText}>Back to Admin</Text>
            </TouchableOpacity>
        </View>
        
    
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F7f2eb',
        padding: 20
    },
    tournamentCompleteContainer: {
        backgroundColor: '#d4edda',
        borderColor: '#c3e6cb',
        borderWidth: 1,
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        width: '100%',
        alignItems: 'center'
    },
    tournamentCompleteText: {
        color: '#155724',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    tournamentCompleteSubText: {
        color: '#155724',
        fontSize: 14,
        marginTop: 5,
        textAlign: 'center'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333'
    },
    wheelContainer: {
        width: width * 0.8,
        height: width * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        position: 'relative'
    },
    wheel: {
        width: '100%',
        height: '100%',
        borderRadius: width * 0.4,
        borderWidth: 2,
        borderColor: '#333',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 3s cubic-bezier(0.17, 0.67, 0.83, 0.67)'
    },
    emptyWheelContainer: {
        width: '100%',
        height: '100%',
        borderRadius: width * 0.4,
        borderWidth: 2,
        borderColor: '#ccc',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    emptyWheelText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#6c757d',
        textAlign: 'center',
        padding: 20
    },
    segment: {
        position: 'absolute',
        width: '50%',
        height: '50%',
        left: '50%',
        top: 0,
        transformOrigin: 'bottom left',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 10
    },
    segmentText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        width: width * 0.3,
        textAlign: 'center'
    },
    pointer: {
        position: 'absolute',
        top: -10,
        width: 20,
        height: 20,
        backgroundColor: 'red',
        zIndex: 10,
        transform: [{ rotate: '45deg' }]
    },
    spinButton: {
        backgroundColor: '#007bff',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginVertical: 20
    },
    spinningButton: {
        backgroundColor: '#6c757d'
    },
    spinButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    selectedTeamContainer: {
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#e9ecef',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ced4da'
    },
    selectedTeamText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#495057'
    },
    nextTeamText: {
        fontSize: 16,
        color: '#6c757d',
        marginTop: 5
    },
    matchupList: {
        width: '100%',
        maxHeight: 200,
        marginTop: 10
    },
    matchupListTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#343a40'
    },
    matchupItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#dee2e6',
        marginBottom: 10,
        backgroundColor: '#ffffff',
        borderRadius: 5
    },
    matchupTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5
    },
    teamsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    teamName: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1
    },
    vsText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#dc3545',
        marginHorizontal: 10
    },
    noMatchupsText: {
        fontSize: 16,
        color: '#6c757d',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 10
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 10,
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 5
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#495057'
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 15
    },
    resetButton: {
        backgroundColor: '#dc3545',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        flex: 1,
        marginRight: 5
    },
    resetButtonText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center'
    },
    highlightedResetButton: {
        backgroundColor: '#bd2130'
    },
    viewTournamentsButton: {
        backgroundColor: '#28a745',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        flex: 1,
        marginLeft: 5
    },
    viewTournamentsButtonText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center'
    },
    backButton: {
        marginTop: 15,
        backgroundColor: '#6c757d',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        width: '100%'
    },
    backButtonText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center'
    },
    lastTwoContainer: {
        backgroundColor: '#fff3cd',
        borderColor: '#ffeeba',
        borderWidth: 1,
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        width: '100%'
    },
    lastTwoText: {
        color: '#856404',
        fontSize: 16,
        textAlign: 'center'
    },
    saveTournamentButton: {
        backgroundColor: '#17a2b8',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 5,
        marginTop: 10
    },
    saveTournamentButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    }
});

export default TeamRollerWheel;