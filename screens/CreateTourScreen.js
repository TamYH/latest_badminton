import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    SafeAreaView,
    ScrollView
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CreateTourScreen = ({ navigation }) => {
    const [selected, setSelected] = useState(null);

    const handleSelection = (type) => {
        setSelected(type);
        if (type === 'elimination') {
            navigation.navigate('Elimination');
        } else if (type === 'roundrobin') {
            navigation.navigate('Team', { tournamentMode: 'roundrobin' });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Select Tournament Type</Text>
                
                <View style={styles.cardContainer}>
                    <TouchableOpacity
                        style={[styles.card, selected === 'elimination' && styles.selectedCard]}
                        onPress={() => handleSelection('elimination')}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="trophy-outline" size={48} color="#E21B3C" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>Elimination Tournament</Text>
                            <Text style={styles.cardDescription}>
                                Individual players compete directly against each other in a single-elimination bracket.
                            </Text>
                            <View style={styles.featureContainer}>
                                <Text style={styles.featureTitle}>Features:</Text>
                                <View style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.featureText}>Individual players (not teams)</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.featureText}>Single-elimination format</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.featureText}>Matches depend on number of players</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.card, selected === 'roundrobin' && styles.selectedCard]}
                        onPress={() => handleSelection('roundrobin')}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="repeat-outline" size={48} color="#1368CE" />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>Round Robin Tournament</Text>
                            <Text style={styles.cardDescription}>
                                Teams of 5 players compete against other teams in a round-robin format.
                            </Text>
                            <View style={styles.featureContainer}>
                                <Text style={styles.featureTitle}>Features:</Text>
                                <View style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.featureText}>Teams of 5 players each</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.featureText}>5 matches per team matchup</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.featureText}>Winners advance to next round</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                    <Text style={styles.backButtonText}>Back to Dashboard</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 20,
        color: '#333',
    },
    cardContainer: {
        marginTop: 20,
        gap: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    selectedCard: {
        borderWidth: 2,
        borderColor: '#007bff',
        backgroundColor: '#f0f7ff',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    cardDescription: {
        fontSize: 16,
        color: '#666',
        marginBottom: 15,
        textAlign: 'center',
    },
    featureContainer: {
        backgroundColor: '#f9f9f9',
        padding: 12,
        borderRadius: 8,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    featureText: {
        fontSize: 14,
        color: '#555',
        marginLeft: 8,
    },
    backButton: {
        backgroundColor: '#6c757d',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        marginTop: 30,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 8,
    },
});

export default CreateTourScreen;
