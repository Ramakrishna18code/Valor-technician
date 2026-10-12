declare module "react-native-safe-area-context" {
  import type { ComponentType } from "react";
  import type { ViewProps } from "react-native";
  export const SafeAreaView: ComponentType<ViewProps & { edges?: string[] }>;
}
