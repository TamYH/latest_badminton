// config.js

// Firebase Core & Services
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBJwuwSsw4u8XtQf1xpNyN8MAFyCC1wjLY",
  authDomain: "sport-tour-b36b1.firebaseapp.com",
  projectId: "sport-tour-b36b1",
storageBucket: "sport-tour-b36b1.appspot.com",
  messagingSenderId: "169301466634",
  appId: "1:169301466634:web:ee85bd3600be7373bac9f3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Persistent Firebase Auth for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore instance
const db = getFirestore(app);

// Export the services
export { auth, db };
