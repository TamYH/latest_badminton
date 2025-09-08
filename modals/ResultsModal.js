import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const ResultsModal = ({ visible, onClose, tournament }) => {
  const [resultsTable, setResultsTable] = useState([]);

  useEffect(() => {
    if (tournament && tournament.matchups) {
      console.log('Tournament received:', tournament);
      generateResultsTable();
    }
  }, [tournament]);

  const generateResultsTable = () => {
  // Handle different data structures - some tournaments have 'teams', others have 'players'
  const teams = tournament.teams || tournament.players;
  const matchups = tournament.matchups;

  if (!tournament || !teams || !matchups) {
    console.log('Missing tournament data:', { 
      tournament, 
      teams: teams, 
      matchups: matchups,
      hasTeams: !!tournament.teams,
      hasPlayers: !!tournament.players
    });
    return;
  }

  console.log('Tournament type:', tournament.type);
  console.log('Teams/Players:', teams);
  console.log('Matchups:', matchups);

  // Check tournament type - if it has type property, use it, otherwise detect from structure
  const tournamentType = tournament.type || 'round_robin';
  
  if (tournamentType === 'elimination') {
    generateEliminationResults();
  } else {
    generateRoundRobinResults();
  }
};


  // New function for elimination tournaments
  const generateEliminationResults = () => {
  // Use players array if teams array doesn't exist
  const teams = tournament.teams || tournament.players;
  const completedMatchups = tournament.matchups.filter(m => m.completed && m.winner);
  const allMatchups = tournament.matchups;
  
  console.log('Elimination Tournament Data:', { teams, completedMatchups, allMatchups });
  
  // Track player status in elimination tournament
  const playerStatus = {};
  const roundProgression = {};
  const matchHistory = [];
  
  // Initialize all players - handle both team and player objects
  teams.forEach(team => {
    playerStatus[team.id] = {
      id: team.id,
      name: team.name,
      status: 'active', // 'active', 'eliminated', 'champion'
      eliminatedInRound: null,
      totalWins: 0,
      totalLosses: 0,
      eliminatedBy: null,
      reachedRound: 1
    };
  });

  // Track round progression
  const maxRound = allMatchups.length > 0 ? Math.max(...allMatchups.map(m => m.round || 1)) : 1;
  for (let round = 1; round <= maxRound; round++) {
    roundProgression[round] = {
      round: round,
      totalMatches: allMatchups.filter(m => (m.round || 1) === round).length,
      completedMatches: completedMatchups.filter(m => (m.round || 1) === round).length,
      roundName: getRoundName(round, maxRound)
    };
  }

  // Process matches
  completedMatchups.forEach(match => {
    const winnerId = match.winner;
    const loserId = match.team1Id === winnerId ? match.team2Id : match.team1Id;
    
    // Get winner and loser names from teams/players array
    const winnerTeam = teams.find(team => team.id === winnerId);
    const loserTeam = teams.find(team => team.id === loserId);
    
    const winnerName = winnerTeam ? winnerTeam.name : 'Unknown';
    const loserName = loserTeam ? loserTeam.name : 'Unknown';
    
    // Record match in history
    matchHistory.push({
      round: match.round || 1,
      winner: winnerName,
      loser: loserName,
      roundName: getRoundName(match.round || 1, maxRound),
      winnerId: winnerId,
      loserId: loserId
    });
    
    // Update winner stats
    if (playerStatus[winnerId]) {
      playerStatus[winnerId].totalWins++;
      playerStatus[winnerId].reachedRound = Math.max(playerStatus[winnerId].reachedRound, (match.round || 1) + 1);
    }
    
    // Update loser stats and eliminate
    if (playerStatus[loserId]) {
      playerStatus[loserId].totalLosses++;
      playerStatus[loserId].status = 'eliminated';
      playerStatus[loserId].eliminatedInRound = match.round || 1;
      playerStatus[loserId].eliminatedBy = winnerName;
      playerStatus[loserId].reachedRound = match.round || 1;
    }
  });

  // Determine champion
  const activePlayers = Object.values(playerStatus).filter(player => player.status === 'active');
  
  if (activePlayers.length === 1 && completedMatchups.length > 0) {
    activePlayers[0].status = 'champion';
  }

  // Sort players for final rankings
  const sortedResults = Object.values(playerStatus).sort((a, b) => {
    if (a.status === 'champion') return -1;
    if (b.status === 'champion') return 1;
    if (b.reachedRound !== a.reachedRound) return b.reachedRound - a.reachedRound;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return a.name.localeCompare(b.name);
  });

  const finalResults = {
    type: 'elimination',
    players: sortedResults,
    roundProgression: Object.values(roundProgression),
    matchHistory: matchHistory.reverse(), // Most recent first
    tournamentStats: {
      totalRounds: maxRound,
      champion: sortedResults.find(p => p.status === 'champion'),
      isComplete: activePlayers.length <= 1 && completedMatchups.length > 0
    }
  };

  console.log('Final elimination results:', finalResults);
  setResultsTable(finalResults);
};


  // Helper function to get round names
  const getRoundName = (round, totalRounds) => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semi-Final";
    if (round === totalRounds - 2) return "Quarter-Final";
    if (round === 1) return "First Round";
    return `Round ${round}`;
  };

  // Original round robin function (keeping it as is)
  const generateRoundRobinResults = () => {
  // Use players array if teams array doesn't exist
  const teams = tournament.teams || tournament.players;
  const completedMatchups = tournament.matchups.filter(m => m.completed && m.winner);
  const allMatchups = tournament.matchups;



  // Initialize results matrix
  const results = {};
  const teamStats = {};

  // Initialize team stats
  teams.forEach(team => {
    teamStats[team.id] = {
      id: team.id,
      name: team.name,
      totalWins: 0,
      totalMatches: 0,
      individualWins: 0,
      individualLosses: 0,
      points: 0
    };
    results[team.id] = {};
    teams.forEach(opponent => {
      if (team.id !== opponent.id) {
        results[team.id][opponent.id] = {
          wins: 0,
          losses: 0,
          played: 0,
          result: null // 'W', 'L', or null
        };
      }
    });
  });

  // Group matchups by team pairing to calculate team vs team results
  const teamMatchups = {};
 
  completedMatchups.forEach(match => {
    const pairingKey = [match.team1Id, match.team2Id].sort().join('-');
   
    if (!teamMatchups[pairingKey]) {
      teamMatchups[pairingKey] = {
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        team1Wins: 0,
        team2Wins: 0,
        completed: 0
      };
    }
   
    // Count individual match wins
    if (match.winner === match.team1Id) {
      teamMatchups[pairingKey].team1Wins++;
      teamStats[match.team1Id].individualWins++;
      teamStats[match.team2Id].individualLosses++;
    } else if (match.winner === match.team2Id) {
      teamMatchups[pairingKey].team2Wins++;
      teamStats[match.team2Id].individualWins++;
      teamStats[match.team1Id].individualLosses++;
    }
   
    teamMatchups[pairingKey].completed++;
  });

  // Calculate team vs team results
  Object.values(teamMatchups).forEach(pairing => {
    const team1Id = pairing.team1Id;
    const team2Id = pairing.team2Id;
   
    // Update results matrix with current score
    results[team1Id][team2Id] = {
      wins: pairing.team1Wins,
      losses: pairing.team2Wins,
      played: pairing.completed > 0 ? 1 : 0,
      result: pairing.team1Wins > pairing.team2Wins ? 'W' :
              pairing.team2Wins > pairing.team1Wins ? 'L' : null
    };
   
    results[team2Id][team1Id] = {
      wins: pairing.team2Wins,
      losses: pairing.team1Wins,
      played: pairing.completed > 0 ? 1 : 0,
      result: pairing.team2Wins > pairing.team1Wins ? 'W' :
              pairing.team1Wins > pairing.team2Wins ? 'L' : null
    };

    // Award points based on completion status
    if (pairing.completed > 0) {
      if (pairing.completed === 5) {
        // Full match completed - award full points
        teamStats[team1Id].totalMatches++;
        teamStats[team2Id].totalMatches++;
       
        if (pairing.team1Wins > pairing.team2Wins) {
          teamStats[team1Id].totalWins++;
          teamStats[team1Id].points += 2;
        } else if (pairing.team2Wins > pairing.team1Wins) {
          teamStats[team2Id].totalWins++;
          teamStats[team2Id].points += 2;
        } else {
          teamStats[team1Id].points += 1;
          teamStats[team2Id].points += 1;
        }
      } else {
        // Partial match - award partial points based on current lead
        const totalMatches = pairing.completed;
        const progressPoints = (totalMatches / 5) * 2;
       
        if (pairing.team1Wins > pairing.team2Wins) {
          teamStats[team1Id].points += progressPoints * 0.6;
          teamStats[team2Id].points += progressPoints * 0.4;
        } else if (pairing.team2Wins > pairing.team1Wins) {
          teamStats[team2Id].points += progressPoints * 0.6;
          teamStats[team1Id].points += progressPoints * 0.4;
        } else {
          teamStats[team1Id].points += progressPoints * 0.5;
          teamStats[team2Id].points += progressPoints * 0.5;
        }
      }
    }
  });

  // Convert to array format for table display
  const tableData = teams.map(team => ({
    ...teamStats[team.id],
    results: results[team.id]
  }));

  // Sort by points (desc), then by total wins (desc), then by individual wins (desc)
  tableData.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.individualWins - a.individualWins;
  });

  // Check if tournament is complete and determine champion
  const isComplete = allMatchups.length > 0 && 
    (allMatchups.filter(m => m.completed).length === allMatchups.length);
  
  // Add tournament stats to the results
  const roundRobinResults = {
    tableData,
    tournamentStats: {
      isComplete,
      champion: isComplete && tableData.length > 0 ? tableData[0] : null,
      totalMatches: allMatchups.length,
      completedMatches: completedMatchups.length
    }
  };

  setResultsTable(roundRobinResults);
};



  const getTeamColor = (index) => {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    return colors[index % colors.length];
  };

  const renderResultCell = (team, opponent) => {
    if (!team.results[opponent.id] || !team.results[opponent.id].played) {
      return <Text style={styles.resultCellText}>–</Text>;
    }

    const result = team.results[opponent.id];
    const isWin = result.result === 'W';
   
    return (
      <Text style={[
        styles.resultCellText,
        isWin ? styles.winText : styles.lossText
      ]}>
        {result.wins}–{result.losses} ({result.result})
      </Text>
    );
  };

  // Custom Simple Bar Chart Component
  const SimpleBarChart = ({ data, title }) => {
    const maxPoints = Math.max(...data.map(item => item.points), 1);
    const barWidth = (screenWidth - 80) / data.length;
   
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.barChartContainer}>
          <View style={styles.barsContainer}>
            {data.map((team, index) => {
              const barHeight = (team.points / maxPoints) * 120;
              return (
                <View key={team.id} style={[styles.barWrapper, { width: barWidth }]}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight || 2,
                          backgroundColor: getTeamColor(index)
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>{team.points}</Text>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {team.name.substring(0, 8)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // Custom Simple Pie Chart Component
  const SimplePieChart = ({ data, title }) => {
    const total = data.reduce((sum, item) => sum + item.points, 0);
   
    if (total === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>{title}</Text>
          <View style={styles.pieChartContainer}>
            <Text style={styles.noDataText}>No data available</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.pieChartContainer}>
          <View style={styles.pieChart}>
            {data.map((team, index) => {
              const percentage = (team.points / total * 100).toFixed(1);
              return (
                <View key={team.id} style={styles.pieSliceInfo}>
                  <View style={[styles.pieColorBox, { backgroundColor: getTeamColor(index) }]} />
                  <Text style={styles.pieSliceText}>
                    {team.name}: {team.points} pts ({percentage}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  if (!tournament) return null;

  // Determine if this is elimination tournament
  const isElimination = tournament.type === 'elimination' || 
                       (resultsTable.type === 'elimination') ||
                       (typeof resultsTable === 'object' && !Array.isArray(resultsTable) && resultsTable.players);

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{tournament.name} - Results</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 
          
          */}


          {isElimination ? (
            // Elimination Tournament Display
            <>
              {/* Championship Banner */}
              {resultsTable.tournamentStats?.champion && (
                <View style={styles.championshipBanner}>
                  <Text style={styles.championshipTitle}>🏆 TOURNAMENT CHAMPION 🏆</Text>
                  <Text style={styles.championshipName}>
                    {resultsTable.tournamentStats.champion.name}
                  </Text>
                </View>
              )}

              {/* Tournament Bracket Progression */}
              {resultsTable.roundProgression && resultsTable.roundProgression.length > 0 && (
                <View style={styles.bracketContainer}>
                  <Text style={styles.sectionTitle}>Tournament Progress</Text>
                  
                  {resultsTable.roundProgression.map((round) => (
                    <View key={round.round} style={styles.roundContainer}>
                      <View style={styles.roundHeader}>
                        <Text style={styles.roundTitle}>{round.roundName}</Text>
                        <Text style={styles.roundProgress}>
                          {round.completedMatches}/{round.totalMatches} completed
                        </Text>
                      </View>
                      
                      <View style={styles.progressBarContainer}>
                        <View 
                          style={[
                            styles.progressBar, 
                            { width: `${Math.min((round.completedMatches / Math.max(round.totalMatches, 1)) * 100, 100)}%` }
                          ]} 
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Final Rankings */}
              {resultsTable.players && resultsTable.players.length > 0 && (
                <View style={styles.playerRankingsContainer}>
                  <Text style={styles.sectionTitle}>Final Rankings</Text>
                  
                  {resultsTable.players.map((player, index) => (
                    <View key={player.id} style={[
                      styles.playerRankRow,
                      player.status === 'champion' ? styles.championRow : null,
                      player.status === 'active' ? styles.activeRow : styles.eliminatedRow
                    ]}>
                      <View style={styles.rankBadge}>
                        <Text style={[
                          styles.rankText,
                          player.status === 'champion' ? styles.championRankText : null
                        ]}>
                          {player.status === 'champion' ? '👑' : `#${index + 1}`}
                        </Text>
                      </View>
                      
                      <View style={styles.playerDetails}>
                        <Text style={[
                          styles.playerName,
                          player.status === 'champion' ? styles.championText : null
                        ]}>
                          {player.name}
                        </Text>
                        
                        <Text style={styles.playerStatus}>
                          {player.status === 'champion' && '🏆 Champion'}
                          {player.status === 'active' && '✅ Still in tournament'}
                          {player.status === 'eliminated' && `❌ Eliminated in ${getRoundName(player.eliminatedInRound, resultsTable.tournamentStats?.totalRounds || 1)}`}
                        </Text>
                        
                        {player.eliminatedBy && (
                          <Text style={styles.eliminatedByText}>
                            Lost to: {player.eliminatedBy}
                          </Text>
                        )}
                      </View>
                      
                      <View style={styles.winsContainer}>
                        <Text style={styles.winsText}>{player.totalWins}W</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Match Results */}
              {resultsTable.matchHistory && resultsTable.matchHistory.length > 0 && (
                <View style={styles.matchHistoryContainer}>
                  <Text style={styles.sectionTitle}>Match Results</Text>
                  
                  {resultsTable.matchHistory.map((match, index) => (
                    <View key={index} style={styles.matchHistoryItem}>
                      <View style={styles.matchRoundBadge}>
                        <Text style={styles.matchRoundText}>{match.roundName}</Text>
                      </View>
                      
                      <View style={styles.matchDetails}>
                        <Text style={styles.matchResult}>
                          <Text style={styles.winnerText}>✅ {match.winner}</Text>
                          <Text style={styles.defeatedText}> defeated </Text>
                          <Text style={styles.loserText}>❌ {match.loser}</Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Show message if no data */}
              {(!resultsTable.players || resultsTable.players.length === 0) && (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No tournament data available yet.</Text>
                  <Text style={styles.noDataSubtext}>Complete some matches to see results.</Text>
                </View>
              )}
            </>
          ) : (
            // Round Robin Tournament Display (existing code)
            <>
              {/* Charts Section */}
              {resultsTable.tournamentStats?.isComplete && resultsTable.tournamentStats?.champion && (
  <View style={styles.championshipBanner}>
    <Text style={styles.championshipTitle}>🏆 TOURNAMENT CHAMPION 🏆</Text>
    <Text style={styles.championshipName}>
      {resultsTable.tournamentStats.champion.name}
    </Text>
    <Text style={styles.championshipPoints}>
      {resultsTable.tournamentStats.champion.points} Points
    </Text>
  </View>
)}

{resultsTable.tableData && resultsTable.tableData.length > 0 && (
  <View style={styles.chartsContainer}>
    <Text style={styles.sectionTitle}>Tournament Statistics</Text>
    
    {/* Simple Bar Chart */}
    <SimpleBarChart
      data={resultsTable.tableData}
      title="Team Points Comparison"
    />

    {/* Simple Pie Chart */}
    <SimplePieChart
      data={resultsTable.tableData}
      title="Points Distribution"
    />
  </View>
)}


              {/* Standings Section */}
              <View style={styles.standingsContainer}>
                <Text style={styles.sectionTitle}>Current Standings</Text>
                {resultsTable.tableData && resultsTable.tableData.map((team, index) => (
                  <View key={team.id} style={[
                    styles.standingRow,
                    index === 0 && resultsTable.tournamentStats?.isComplete ? styles.championRow : null,
                    index === 0 ? styles.firstPlace : null,
                    index === 1 ? styles.secondPlace : null,
                    index === 2 ? styles.thirdPlace : null
                  ]}>
                    <View style={styles.rankContainer}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamNameStanding}>{team.name}</Text>
                      <Text style={styles.teamStats}>
                        {team.points} pts • {team.totalWins}W-{team.totalMatches - team.totalWins}L • {team.individualWins}-{team.individualLosses} individual
                      </Text>
                    </View>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsBadgeText}>{team.points}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Results Table Section */}
    {resultsTable.tableData && resultsTable.tableData.length > 0 && (
      <View style={styles.tableContainer}>
        <Text style={styles.sectionTitle}>Head-to-Head Results</Text>
       
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={[styles.cell, styles.headerCell, styles.teamNameCell]}>
                <Text style={styles.headerText}>Team</Text>
              </View>
              {resultsTable.tableData.map(opponent => (
                <View key={opponent.id} style={[styles.cell, styles.headerCell]}>
                  <Text style={styles.headerText} numberOfLines={1}>
                    vs {opponent.name.substring(0, 6)}
                  </Text>
                </View>
              ))}
              <View style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>Total Wins</Text>
              </View>
              <View style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>Points</Text>
              </View>
            </View>

            {/* Data Rows */}
            {resultsTable.tableData.map((team, index) => (
              <View key={team.id} style={[
                styles.dataRow,
                index % 2 === 0 ? styles.evenRow : styles.oddRow,
                resultsTable.tournamentStats?.isComplete && index === 0 ? styles.championRow : null,
                index === 0 ? styles.leaderRow : null
              ]}>
                <View style={[styles.cell, styles.teamNameCell]}>
                  <Text style={[
                    styles.teamNameText,
                    resultsTable.tournamentStats?.isComplete && index === 0 ? styles.championText : null
                  ]} numberOfLines={1}>
                    {index + 1}. {team.name}
                  </Text>
                </View>
                {resultsTable.tableData.map(opponent => (
                  <View key={opponent.id} style={styles.cell}>
                    {team.id === opponent.id ? (
                      <Text style={styles.resultCellText}>–</Text>
                    ) : (
                      renderResultCell(team, opponent)
                    )}
                  </View>
                ))}
                <View style={styles.cell}>
                  <Text style={styles.totalWinsText}>{team.totalWins}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.pointsText}>{team.points.toFixed(1)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    )}

    {/* No data message */}
    {(!resultsTable.tableData || resultsTable.tableData.length === 0) && (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No tournament data available yet.</Text>
        <Text style={styles.noDataSubtext}>Complete some matches to see results.</Text>
      </View>
    )}
  </>
)}



          {/* Summary Stats */}
        <View style={styles.summaryContainer}>
  <Text style={styles.sectionTitle}>Tournament Summary</Text>
  <View style={styles.summaryGrid}>
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>
        {(tournament.teams?.length || tournament.players?.length) || 0}
      </Text>
      <Text style={styles.summaryLabel}>
        {tournament.teams ? 'Teams' : 'Players'}
      </Text>
    </View>
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>
        {tournament.matchups?.filter(m => m.completed).length || 0}
      </Text>
      <Text style={styles.summaryLabel}>Completed Matches</Text>
    </View>
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>
        {tournament.matchups?.length || 0}
      </Text>
      <Text style={styles.summaryLabel}>Total Matches</Text>
    </View>
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>
        {Math.round((tournament.matchups?.filter(m => m.completed).length || 0) /
          (tournament.matchups?.length || 1) * 100)}%
      </Text>
      <Text style={styles.summaryLabel}>Progress</Text>
    </View>
  </View>
</View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007bff',
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#343a40',
  },
  chartsContainer: {
    marginBottom: 24,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#495057',
  },
  // Simple Bar Chart Styles
  barChartContainer: {
    height: 180,
    justifyContent: 'flex-end',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 150,
  },
  barWrapper: {
    alignItems: 'center',
  },
  barContainer: {
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 30,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 2,
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    color: '#495057',
  },
  barLabel: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 2,
    textAlign: 'center',
  },
  // Simple Pie Chart Styles
  pieChartContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  pieChart: {
    width: '100%',
  },
  pieSliceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pieColorBox: {
    width: 16,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  pieSliceText: {
    fontSize: 14,
    color: '#495057',
  },
  noDataText: {
    fontSize: 16,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  // Standings Styles
  standingsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  firstPlace: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  secondPlace: {
    backgroundColor: '#e8f4f8',
    borderLeftWidth: 4,
    borderLeftColor: '#6c757d',
  },
  thirdPlace: {
    backgroundColor: '#f8d7da',
    borderLeftWidth: 4,
    borderLeftColor: '#cd853f',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
  },
  teamInfo: {
    flex: 1,
    marginLeft: 12,
  },
  teamNameStanding: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
  },
  teamStats: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: '#007bff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  pointsBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Table Styles (keeping the existing ones)
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
  },
  dataRow: {
    flexDirection: 'row',
  },
  evenRow: {
    backgroundColor: '#ffffff',
  },
  oddRow: {
    backgroundColor: '#f8f9fa',
  },
  leaderRow: {
    backgroundColor: '#e8f4f8',
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  cell: {
    width: 80,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#dee2e6',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  headerCell: {
    backgroundColor: '#6c757d',
  },
  teamNameCell: {
    width: 120,
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  teamNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212529',
    textAlign: 'left',
  },
  resultCellText: {
    fontSize: 11,
    textAlign: 'center',
    color: '#495057',
  },
  winText: {
    color: '#28a745',
    fontWeight: 'bold',
  },
  lossText: {
    color: '#dc3545',
    fontWeight: 'bold',
  },
  totalWinsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007bff',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#28a745',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },

  // New Elimination Tournament Styles
  championshipBanner: {
    backgroundColor: '#FFD700',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#FFA500',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  championshipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: 8,
    textAlign: 'center',
  },
  championshipName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B4513',
    textAlign: 'center',
  },
  bracketContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  roundContainer: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
    paddingLeft: 12,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  roundProgress: {
    fontSize: 12,
    color: '#7f8c8d',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 3,
  },
  playerRankingsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  playerRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 3,
    borderLeftColor: '#dee2e6',
  },
  championRow: {
    backgroundColor: '#fff3cd',
    borderLeftColor: '#ffc107',
    borderWidth: 2,
    borderColor: '#ffc107',
  },
  activeRow: {
    backgroundColor: '#d4edda',
    borderLeftColor: '#28a745',
  },
  eliminatedRow: {
    backgroundColor: '#f8d7da',
    borderLeftColor: '#dc3545',
    opacity: 0.9,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  championRankText: {
    fontSize: 16,
    color: 'white',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  championText: {
    color: '#f39c12',
    fontSize: 18,
  },
  playerStatus: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  eliminatedByText: {
    fontSize: 11,
    color: '#e74c3c',
    fontStyle: 'italic',
  },
  winsContainer: {
    alignItems: 'center',
  },
  winsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60',
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchHistoryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  matchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  matchRoundBadge: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  matchRoundText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  matchDetails: {
    flex: 1,
  },
  matchResult: {
    fontSize: 14,
    lineHeight: 20,
  },
  winnerText: {
    fontWeight: 'bold',
    color: '#27ae60',
  },
  defeatedText: {
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  loserText: {
    color: '#e74c3c',
  },
  noDataContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  
championshipPoints: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#8B4513',
  marginTop: 4,
},

});

export default ResultsModal;
