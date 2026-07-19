import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

const ACCENT = "#059669";
const INACTIVE = "#9ca3af";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTintColor: "#111827",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Platform.select({ ios: 28, default: 16 }),
          height: 64,
          borderRadius: 28,
          borderTopWidth: 0,
          backgroundColor: "#ffffff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: "Properties",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "business" : "business-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tenants"
        options={{
          title: "Tenants",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rent"
        options={{
          title: "Rent",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "cash" : "cash-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
