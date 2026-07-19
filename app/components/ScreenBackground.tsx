import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

export function ScreenBackground({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={["#ecfdf5", "#f7fdfb", "#fafafa"]}
      locations={[0, 0.35, 1]}
      style={styles.fill}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
