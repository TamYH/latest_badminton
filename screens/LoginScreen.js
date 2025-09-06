import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Keyboard, TouchableWithoutFeedback } from 'react-native';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        try {
            // Sign in user with email and password
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Fetch the user's document from Firestore
            const sanitizedEmail = email.replace('@', '_').replace('.', '_');
            const userDocRef = doc(db, 'users', sanitizedEmail);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userRole = userData.role;

                // username field 
                const username = userData.username; // This will be the part before @ in the email
                
                console.log(`User logged in: ${username} with role: ${userRole}`);

                // Navigate to the correct screen based on the role
                if (userRole === 'admin') {
                    navigation.replace('AdminScreen');
                } else {
                    navigation.replace('UserScreen');
                }
            } else {
                Alert.alert('Error', 'No user role assigned in Firestore.');
            }

        } catch (error) {
            // Firebase Authentication error handling
            console.log('Error details:', error);  // Log the error to the console for debugging
            if (error.code === 'auth/invalid-email') {
                Alert.alert('Email Invalid', 'Please enter a valid email address.');
            } else if (error.code === 'auth/user-not-found') {
                Alert.alert('Email Not Found', 'No user found with this email address.');
            } else if (error.code === 'auth/wrong-password') {
                Alert.alert('Incorrect Password', 'The password you entered is incorrect.');
            } else if (error.code === 'auth/too-many-requests') {
                Alert.alert('Too Many Requests', 'You have made too many login attempts. Please try again later.');
            } else {
                Alert.alert('Login Error', error.message);  // Generic error fallback
            }
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
            <Image source={require('../assets/images/login.jpg')} style={styles.logo} />

            <Text style={styles.title}>Login</Text>

            <View style={styles.inputContainer}>
                <Icon name="mail-outline" size={20} style={styles.icon} />
                <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            </View>

            <View style={styles.inputContainer}>
                <Icon name="lock-closed-outline" size={20} style={styles.icon} />
                <TextInput
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerText}>
                    Don't have an account? <Text style={{ color: 'black' }}>Register here</Text>
                </Text>
            </TouchableOpacity>
        </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    logo: {
        width: 500,
        height: 150,
        resizeMode: 'contain',
        marginBottom: 30,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 5,
        marginBottom: 15,
        paddingHorizontal: 10,
        width: '100%',
        height: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    icon: {
        marginRight: 10,
        color: '#777',
    },
    input: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 10,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 5,
        marginBottom: 20,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    registerText: {
        color: '#007BFF',
        textAlign: 'center',
        fontSize: 16,
    },
});