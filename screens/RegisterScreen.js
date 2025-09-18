import React, { useState, useLayoutEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc } from 'firebase/firestore';
import logo from '../assets/images/register.png'; // Adjust the path as needed
import Icon from 'react-native-vector-icons/Ionicons';
import { Keyboard, TouchableWithoutFeedback } from 'react-native';

export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user'); // Default role is 'user'

    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
                    <Icon name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

    const handleRegister = async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get username (part before @)
            const username = email.split('@')[0];
            
            // Get sanitized email for document ID (same format as LoginScreen)
            const sanitizedEmail = email.replace('@', '_').replace('.', '_');

            // Store user data with the format expected by LoginScreen
            const userDocRef = doc(db, 'users', sanitizedEmail);
            await setDoc(userDocRef, { 
                role,
                username, // Store the username for later use
                email     // Store the original email too
            });

            Alert.alert('Registration Successful', `You are registered as a ${role}`);
            //navigation.replace(role === 'admin' ? 'AdminScreen' : 'UserScreen');
        } catch (error) {
            Alert.alert('Registration Error', error.message);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <Image source={logo} style={styles.logo} />
                <Text style={styles.title}>Register</Text>

                <View style={styles.inputContainer}>
                    <Icon name="mail-outline" size={20} color="#888" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        style={styles.inputWithIcon}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Icon name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.inputWithIcon}
                    />
                </View>

                <Text style={styles.roleText}>Register as:</Text>
                <View style={styles.roleSelection}>
                    <TouchableOpacity
                        style={[styles.roleButton, role === 'user' && styles.selectedRoleButton]}
                        onPress={() => setRole('user')}
                    >
                        <Text style={styles.roleButtonText}>User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.roleButton, role === 'admin' && styles.selectedRoleButton]}
                        onPress={() => setRole('admin')}
                    >
                        <Text style={styles.roleButtonText}>Admin</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.selectedRoleText}>Selected Role: {role === 'user' ? 'User' : 'Admin'}</Text>

                <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                    <Text style={styles.registerButtonText}>Register</Text>
                </TouchableOpacity>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f4f4f4' },
    logo: { width: 200, height: 150, marginBottom: 60 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    input: { width: '100%', padding: 12, borderRadius: 5, backgroundColor: 'white', marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
    roleText: { textAlign: 'center', marginTop: 20, fontSize: 16, fontWeight: 'bold' },
    roleSelection: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    roleButton: { padding: 10, margin: 5, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, backgroundColor: '#fff' },
    selectedRoleButton: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
    roleButtonText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    selectedRoleText: { textAlign: 'center', marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#333' },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 15,
        width: '100%',
    },

    inputIcon: {
        marginRight: 10,
    },

    inputWithIcon: {
        flex: 1,
        paddingVertical: 12,
    },

    registerButton: {
        backgroundColor: '#007BFF',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 8,
        marginTop: 20,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3, // For Android shadow
    },
    
    registerButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});