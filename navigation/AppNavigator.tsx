import { useEffect, useRef } from 'react';
import { NavigationContainer, LinkingOptions, DefaultTheme, DarkTheme, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from './types';
import * as Linking from 'expo-linking';
import { useTheme } from '../lib/theme-context';
import { useAuth } from '../lib/auth-context';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import CreateEditRouteScreen from '../screens/CreateEditRouteScreen';
import AdminPhotosScreen from '../screens/AdminPhotosScreen';
import AdminPhotoDetailScreen from '../screens/AdminPhotoDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MySendsScreen from '../screens/MySendsScreen';
import MyCommentsScreen from '../screens/MyCommentsScreen';
import RouteSendsScreen from '../screens/RouteSendsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'https://up-app-one.vercel.app', 'upapp:///'],
  config: {
    initialRouteName: 'Home',
    screens: {
      Home: '',
      Login: 'login',
      Signup: 'signup',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      RouteDetail: 'route/:routeId',
      CreateEditRoute: 'route/edit/:routeId?',
      AdminPhotos: 'admin/photos',
      AdminPhotoDetail: 'admin/photo/:photoId',
      Settings: 'settings',
      MySends: 'sends',
      MyComments: 'comments',
      RouteSends: 'route/:routeId/sends',
      UserProfile: 'user/:userId',
      ChangePassword: 'settings/change-password',
    },
  },
};

export default function AppNavigator() {
  const { t } = useTranslation();
  const { isDark, colors } = useTheme();
  const { isPasswordRecovery } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    if (isPasswordRecovery && navigationRef.current) {
      navigationRef.current.reset({ index: 0, routes: [{ name: 'ResetPassword' }] });
    }
  }, [isPasswordRecovery]);

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.screenBackground,
      card: colors.cardBackground,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navigationTheme}>
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
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RouteDetail"
          component={RouteDetailScreen}
          options={{
            headerShown: true,
            title: t('nav.routeDetails'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="CreateEditRoute"
          component={CreateEditRouteScreen}
          options={({ route }) => ({
            headerShown: true,
            title: route.params?.routeId ? t('nav.editRoute') : t('nav.createRoute'),
            headerBackTitle: t('common.back'),
          })}
        />
        <Stack.Screen
          name="AdminPhotos"
          component={AdminPhotosScreen}
          options={{
            headerShown: true,
            title: t('nav.managePhotos'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="AdminPhotoDetail"
          component={AdminPhotoDetailScreen}
          options={{
            headerShown: true,
            title: t('nav.photoDetails'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            title: t('nav.settings'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="MySends"
          component={MySendsScreen}
          options={{
            headerShown: true,
            title: t('nav.mySends'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="MyComments"
          component={MyCommentsScreen}
          options={{
            headerShown: true,
            title: t('nav.myComments'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="RouteSends"
          component={RouteSendsScreen}
          options={{
            headerShown: true,
            title: t('nav.sends'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{
            headerShown: true,
            title: t('nav.profile'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{
            headerShown: true,
            title: t('nav.changePassword'),
            headerBackTitle: t('common.back'),
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
