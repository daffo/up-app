import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";

export type RootStackParamList = {
  Home: undefined;
  Login: { redirectTo?: keyof RootStackParamList } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  RouteDetail: { routeId: string };
  CreateEditRoute: { routeId?: string } | undefined;
  AdminPhotos: undefined;
  AdminPhotoDetail: { photoId: string };
  Settings: undefined;
  MyLogs: undefined;
  MySaved: undefined;
  MyComments: undefined;
  RouteSends: { routeId: string };
  FallHoldPicker: { routeId: string; currentFallHoldId: string | null };
  UserProfile: { userId: string };
  ChangePassword: undefined;
};

/** Screen props for a given route */
export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Navigation prop usable with useNavigation() */
export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;
