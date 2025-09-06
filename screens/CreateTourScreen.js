import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CreateTourScreen = ({ navigation }) => {
    const [selected, setSelected] = useState(null);

    const handleSelection = (type) => {
        setSelected(type);
        if (type === 'elimination') {
            navigation.navigate('Elimination'); // must match screen name in navigator
        } else if (type === 'roundrobin') {
            navigation.navigate('Team'); // must match screen name in navigator
        }
    };


    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Select Type of Tournament</Text>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.redButton, selected === 'elimination' && styles.selectedButton]}
                    onPress={() => handleSelection('elimination')}

                >
                    <Ionicons name="trophy-outline" size={40} color="white" />
                    <Text style={styles.buttonText}>Elimination</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.blueButton, selected === 'roundrobin' && styles.selectedButton]}
                    onPress={() => handleSelection('roundrobin')}
                >
                    <Ionicons name="repeat-outline" size={40} color="white" />
                    <Text style={styles.buttonText}>Round Robin</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 30,
        color: '#333',
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 20,
    },
    button: {
        flex: 1,
        maxHeight: 200,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 15,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    redButton: {
        backgroundColor: '#E21B3C',
    },
    blueButton: {
        backgroundColor: '#1368CE',
    },
    selectedButton: {
        transform: [{ scale: 0.95 }],
        borderWidth: 3,
        borderColor: '#fff',
    },
    buttonText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
    },
});

export default CreateTourScreen;