import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';

interface ScreenHeaderProps {
  theme: Theme;
  title: string;
  trailing?: React.ReactNode;
}

/** Large 34/700 title with optional trailing icon — matches design spec padding (62px top). */
export function ScreenHeader({ theme, title, trailing }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: 16,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontSize: 34,
          fontWeight: '700',
          color: theme.text,
          letterSpacing: -0.8,
        }}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}
