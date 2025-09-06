// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import AdminScreen from './screens/AdminScreen';
import UserScreen from './screens/UserScreen';
import VenueScreen from './screens/VenueScreen';
import RollerWheel from './screens/RollerWheel';
import TeamScreen from './screens/TeamScreen';
import TournamentView from './screens/TournamentView';
import UserTeamView from './screens/UserTeamView';
import UserTournamentView from './screens/UserTournamentView';
import EliminationScreen from './screens/EliminationScreen';
import CreateTourScreen from './screens/CreateTourScreen';
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: true, title: 'Register' }}
        />
        <Stack.Screen name="AdminScreen" component={AdminScreen} />
        <Stack.Screen name="UserScreen" component={UserScreen} />
        <Stack.Screen name="VenueScreen" component={VenueScreen} />
        <Stack.Screen name="RollerWheel" component={RollerWheel} />
        <Stack.Screen name="TeamScreen" component={TeamScreen} />
        <Stack.Screen name="EliminationScreen" component={EliminationScreen} />
        <Stack.Screen name="CreateTour" component={CreateTourScreen} />
        <Stack.Screen name="TournamentView" component={TournamentView} />
        <Stack.Screen name="UserTeamView" component={UserTeamView} />
        <Stack.Screen name="UserTournamentView" component={UserTournamentView} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}