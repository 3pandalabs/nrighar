import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Overview" }} />
      <Tabs.Screen name="properties" options={{ title: "Properties" }} />
      <Tabs.Screen name="tenants" options={{ title: "Tenants" }} />
      <Tabs.Screen name="rent" options={{ title: "Rent" }} />
    </Tabs>
  );
}
