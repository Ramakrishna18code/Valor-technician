import React from "react";

jest.mock("react-native", () => {
  const React = require("react");
  const element = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    ActivityIndicator: element("ActivityIndicator"),
    FlatList: ({ data = [], renderItem, ...props }: any) => React.createElement("FlatList", props, data.map((item: unknown, index: number) => renderItem({ item, index }))),
    Image: element("Image"),
    Modal: element("Modal"),
    Pressable: element("Pressable"),
    RefreshControl: element("RefreshControl"),
    ScrollView: element("ScrollView"),
    StyleSheet: { create: (value: unknown) => value },
    Text: element("Text"),
    TextInput: element("TextInput"),
    View: element("View"),
    Platform: { OS: "android", select: (values: any) => values.android ?? values.default },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const mockReact = require("react");
  return { Ionicons: (props: any) => mockReact.createElement("Ionicons", props) };
});
jest.mock("expo-linear-gradient", () => {
  const mockReact = require("react");
  return { LinearGradient: ({ children, ...props }: any) => mockReact.createElement("LinearGradient", props, children) };
});
jest.mock("../src/components/AvailabilityPicker", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/WorkdayGraphic", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/BrandLogo", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/CalendarGraphic", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/ServiceExperience", () => {
  const mockReact = require("react");
  return { ServiceReveal: ({ children }: any) => mockReact.createElement(mockReact.Fragment, null, children) };
});
jest.mock("../src/components/ProfilePhotoEditor", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/api/technicianApi", () => ({
  technicianApi: {
    getParts: jest.fn(async () => []),
    getVisits: jest.fn(async () => []),
    updateProfile: jest.fn(async () => undefined),
  },
}));

import DashboardScreen from "../src/screens/DashboardScreen";
import HistoryScreen from "../src/screens/HistoryScreen";
import PartsScreen from "../src/screens/PartsScreen";
import ProfileScreen from "../src/screens/ProfileScreen";
import VisitsScreen from "../src/screens/VisitsScreen";
import WelcomeScreen from "../src/screens/WelcomeScreen";

const renderer = require("react-test-renderer");

const callbacks = {
  onRefresh: jest.fn(),
  onAvailability: jest.fn(async () => undefined),
  onJobs: jest.fn(),
  onJob: jest.fn(),
  onVisits: jest.fn(),
  onNotifications: jest.fn(),
  onProfile: jest.fn(),
  onEmergency: jest.fn(),
  onSupport: jest.fn(),
  onHistory: jest.fn(),
  onSafety: jest.fn(),
  onReports: jest.fn(),
};

describe("technician screen smoke coverage", () => {
  it.each([
    ["welcome", React.createElement(WelcomeScreen, { onGetStarted: jest.fn(), onSignIn: jest.fn() })],
    ["dashboard", React.createElement(DashboardScreen, { ...callbacks, dashboard: null, jobs: [], visits: [], loading: false, unreadCount: 0 })],
    ["history", React.createElement(HistoryScreen, { items: [], filter: 0, onLoad: jest.fn(async () => undefined), onFilter: jest.fn(async () => undefined), onJob: jest.fn(), infoForJob: jest.fn() })],
    ["parts", React.createElement(PartsScreen, { jobs: [], onBack: jest.fn() })],
    ["profile", React.createElement(ProfileScreen, { profile: null, dashboard: null, onNavigate: jest.fn(), onLogout: jest.fn() })],
    ["visits", React.createElement(VisitsScreen, { onVisit: jest.fn() })],
  ])("renders the %s screen", async (_name, element) => {
    let tree: unknown;
    await renderer.act(async () => {
      tree = renderer.create(element);
    });
    expect(tree).toBeTruthy();
  });
});
