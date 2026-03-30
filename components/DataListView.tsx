import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  FlatListProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useThemeColors } from '../lib/theme-context';

interface DataListViewProps<T> extends Omit<FlatListProps<T>, 'data' | 'renderItem'> {
  loading: boolean;
  data: T[];
  emptyMessage: string;
  renderItem: FlatListProps<T>['renderItem'];
  loadingStyle?: StyleProp<ViewStyle>;
  emptyTextStyle?: StyleProp<TextStyle>;
}

export default function DataListView<T>({
  loading,
  data,
  emptyMessage,
  renderItem,
  loadingStyle,
  emptyTextStyle,
  contentContainerStyle,
  ...flatListProps
}: DataListViewProps<T>) {
  const colors = useThemeColors();

  if (loading) {
    return (
      <View style={[styles.centered, loadingStyle]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      contentContainerStyle={[
        data.length === 0 ? styles.centered : undefined,
        contentContainerStyle,
      ]}
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: colors.textTertiary }, emptyTextStyle]}>
          {emptyMessage}
        </Text>
      }
      {...flatListProps}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
