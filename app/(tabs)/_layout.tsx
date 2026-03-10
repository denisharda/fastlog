import { Tabs } from 'expo-router';
import { View } from 'react-native';

function TabIcon({ focused, color, icon }: { focused: boolean; color: string; icon: string }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
      }}
    >
      {/* TODO: Replace with proper SVG icons */}
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: focused ? color : 'transparent',
          marginTop: 2,
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A1A1A',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#2D6A4F',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timer',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icon="timer" />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icon="history" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} icon="profile" />
          ),
        }}
      />
    </Tabs>
  );
}
