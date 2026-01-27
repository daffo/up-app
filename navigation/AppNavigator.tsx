import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import CreateEditRouteScreen from '../screens/CreateEditRouteScreen';
import AdminPhotosScreen from '../screens/AdminPhotosScreen';
import AdminPhotoDetailScreen from '../screens/AdminPhotoDetailScreen';
import MyAccountScreen from '../screens/MyAccountScreen';
import MySendsScreen from '../screens/MySendsScreen';
import MyCommentsScreen from '../screens/MyCommentsScreen';
import RouteSendsScreen from '../screens/RouteSendsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RouteDetail"
          component={RouteDetailScreen}
          options={{
            headerShown: true,
            title: 'Route Details',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="CreateEditRoute"
          component={CreateEditRouteScreen}
          options={({ route }: any) => ({
            headerShown: true,
            title: route.params?.routeId ? 'Edit Route' : 'Create Route',
            headerBackTitle: 'Back',
          })}
        />
        <Stack.Screen
          name="AdminPhotos"
          component={AdminPhotosScreen}
          options={{
            headerShown: true,
            title: 'Manage Photos',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="AdminPhotoDetail"
          component={AdminPhotoDetailScreen}
          options={{
            headerShown: true,
            title: 'Photo Details',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="MyAccount"
          component={MyAccountScreen}
          options={{
            headerShown: true,
            title: 'My Account',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="MySends"
          component={MySendsScreen}
          options={{
            headerShown: true,
            title: 'My Sends',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="MyComments"
          component={MyCommentsScreen}
          options={{
            headerShown: true,
            title: 'My Comments',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="RouteSends"
          component={RouteSendsScreen}
          options={{
            headerShown: true,
            title: 'Sends',
            headerBackTitle: 'Back',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
