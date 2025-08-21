import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import {
  createDrawerNavigator,
  DrawerNavigationOptions,
} from '@react-navigation/drawer';

import Header from './components/Header';
import HomeScreen from './screens/HomeScreen';
import RecipeScreen from './screens/RecipeScreen';
import SearchScreen from './screens/SearchScreen';
import MyRecipesScreen from './screens/MyRecipesScreen';

import favorites from './reducers/favorites';
import type { Recipe } from './types'; // si centralisé

// --- Store ---
const store = configureStore({
  reducer: {
    favorites,
  },
});

// --- Navigation ---
type RootStackParamList = {
  Home: undefined;
  Recipe: { recipe: Recipe };
  DrawerNavigator: undefined;
};

type DrawerParamList = {
  Search: undefined;
  'My recipes': undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator = () => (
  <Drawer.Navigator
    initialRouteName="Search"
    screenOptions={{
      header: (props) => <Header {...props} />,
      drawerActiveTintColor: '#655074',
      drawerType: 'back',
    }}
  >
    <Drawer.Screen name="Search" component={SearchScreen} />
    <Drawer.Screen name="My recipes" component={MyRecipesScreen} />
  </Drawer.Navigator>
);

export default function App(): JSX.Element {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Recipe" component={RecipeScreen} />
            <Stack.Screen name="DrawerNavigator" component={DrawerNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
