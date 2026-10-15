import React from "react";

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    ActivityIndicator: host("ActivityIndicator"),
    Pressable: host("Pressable"),
    ScrollView: host("ScrollView"),
    StyleSheet: { create: (value: unknown) => value },
    Text: host("Text"),
    TextInput: host("TextInput"),
    View: host("View"),
  };
});

jest.mock("../src/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 0) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock("../src/api/technicianApi", () => ({
  technicianApi: {
    inspections: jest.fn(),
    inspection: jest.fn(),
    acceptInspection: jest.fn(),
    startInspection: jest.fn(),
    submitInspection: jest.fn(),
    addInspectionEvidence: jest.fn(),
  },
}));

import InspectionsScreen from "../src/screens/InspectionsScreen";
import { ApiError } from "../src/api/client";
import { technicianApi } from "../src/api/technicianApi";

const api = technicianApi as jest.Mocked<typeof technicianApi>;
const renderer = require("react-test-renderer");

const summary = { id: 7, installationRequestId: 668, siteAddressLine1: "Indiranagar", siteCity: "Bengaluru" };
const detail = (status: string, version = 4) => ({
  ...summary,
  status,
  version,
  scheduledAt: null,
  measurements: null,
  findings: null,
  risks: null,
  siteConstraints: null,
  recommendedActions: null,
  recommendations: null,
  conclusion: null,
  assessmentConclusion: null,
  issues: null,
  readinessObservations: null,
});

const textOf = (node: any): string => node.children.map((child: any) => typeof child === "string" ? child : textOf(child)).join("");
const button = (tree: any, label: string) => tree.root.findAllByType("Pressable").find((node: any) => node.findAllByType("Text").some((text: any) => textOf(text).includes(label)));

async function openInspection(status: string, version = 4) {
  api.inspections.mockResolvedValue({ items: [summary] } as any);
  api.inspection.mockResolvedValue(detail(status, version) as any);
  let tree: any;
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(InspectionsScreen));
    await Promise.resolve();
  });
  const card = tree.root.findAllByType("Pressable").at(-1);
  await renderer.act(async () => { await card.props.onPress(); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.startInspection.mockResolvedValue(detail("IN_PROGRESS") as any);
});

test.each(["ASSIGNED", "RESCHEDULE_REQUIRED"])('%s shows Accept inspection and not Start inspection', async status => {
  const tree = await openInspection(status);
  expect(button(tree, "Accept inspection")).toBeTruthy();
  expect(button(tree, "Start inspection")).toBeUndefined();
});

test("ACCEPTED shows Start inspection and not Accept inspection", async () => {
  const tree = await openInspection("ACCEPTED");
  expect(button(tree, "Start inspection")).toBeTruthy();
  expect(button(tree, "Accept inspection")).toBeUndefined();
});

test("successful acceptance sends the current id/version and uses returned backend state", async () => {
  const tree = await openInspection("ASSIGNED", 12);
  const accepted = detail("ACCEPTED", 13);
  api.acceptInspection.mockResolvedValue(accepted as any);

  await renderer.act(async () => { await button(tree, "Accept inspection").props.onPress(); });

  expect(api.acceptInspection).toHaveBeenCalledWith(7, 12);
  expect(button(tree, "Start inspection")).toBeTruthy();
  expect(button(tree, "Accept inspection")).toBeUndefined();
  expect(tree.root.findAllByType("Text").some((text: any) => textOf(text) === "ACCEPTED")).toBe(true);
});

test("duplicate taps while acceptance is pending make one request", async () => {
  const tree = await openInspection("ASSIGNED");
  let resolve!: (value: unknown) => void;
  api.acceptInspection.mockReturnValue(new Promise(value => { resolve = value; }) as any);
  const accept = button(tree, "Accept inspection");

  await renderer.act(async () => { accept.props.onPress(); await Promise.resolve(); });
  await renderer.act(async () => { accept.props.onPress(); await Promise.resolve(); });
  expect(api.acceptInspection).toHaveBeenCalledTimes(1);

  resolve(detail("ACCEPTED", 5));
  await renderer.act(async () => { await Promise.resolve(); });
});

test("stale acceptance refreshes state and does not optimistically enable Start", async () => {
  const tree = await openInspection("ASSIGNED", 4);
  api.acceptInspection.mockRejectedValue(new ApiError("Inspection changed", 409));
  api.inspection.mockResolvedValue(detail("ASSIGNED", 5) as any);

  await renderer.act(async () => { await button(tree, "Accept inspection").props.onPress(); });

  expect(api.acceptInspection).toHaveBeenCalledWith(7, 4);
  expect(api.inspection).toHaveBeenCalledTimes(2);
  expect(button(tree, "Start inspection")).toBeUndefined();
  expect(tree.root.findAllByType("Text").some((text: any) => textOf(text).includes("changed elsewhere"))).toBe(true);
});

test("normal acceptance failure displays an error without enabling Start", async () => {
  const tree = await openInspection("ASSIGNED");
  api.acceptInspection.mockRejectedValue(new Error("Unable to accept inspection."));

  await renderer.act(async () => { await button(tree, "Accept inspection").props.onPress(); });

  expect(button(tree, "Start inspection")).toBeUndefined();
  expect(tree.root.findAllByType("Text").some((text: any) => textOf(text).includes("Unable to accept inspection."))).toBe(true);
});
