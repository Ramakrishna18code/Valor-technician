declare module "react-native-safe-area-context" {
  import type { ComponentType, ReactNode } from "react";
  import type { ViewProps } from "react-native";
  export const SafeAreaProvider: ComponentType<{ children?: ReactNode }>;
  export const SafeAreaView: ComponentType<ViewProps & { edges?: string[] }>;
}
