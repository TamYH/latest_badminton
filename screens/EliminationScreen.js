import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const EliminationScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.successBox}>
        <Text style={styles.successText}>Success!</Text>
        <Text style={styles.messageText}>
          Your operation has been completed successfully.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  successBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default EliminationScreen;