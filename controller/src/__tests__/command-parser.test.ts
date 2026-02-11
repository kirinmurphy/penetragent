import { describe, it, expect } from "vitest";
import { parseCommand } from "../bot/command-parser.js";

describe("parseCommand", () => {
  it("parses a simple command", () => {
    const result = parseCommand("help");
    expect(result).toEqual({ command: "help", args: [] });
  });

  it("parses command with / prefix", () => {
    const result = parseCommand("/help");
    expect(result).toEqual({ command: "help", args: [] });
  });

  it("parses command with args", () => {
    const result = parseCommand("scan staging headers");
    expect(result).toEqual({
      command: "scan",
      args: ["staging", "headers"],
    });
  });

  it("parses command with / prefix and args", () => {
    const result = parseCommand("/scan staging headers");
    expect(result).toEqual({
      command: "scan",
      args: ["staging", "headers"],
    });
  });

  it("handles extra whitespace", () => {
    const result = parseCommand("  scan   staging   headers  ");
    expect(result).toEqual({
      command: "scan",
      args: ["staging", "headers"],
    });
  });

  it("is case insensitive", () => {
    const result = parseCommand("HELP");
    expect(result).toEqual({ command: "help", args: [] });
  });

  it("returns null for unknown commands", () => {
    expect(parseCommand("unknown")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseCommand("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(parseCommand("   ")).toBeNull();
  });

  it("returns null for just /", () => {
    expect(parseCommand("/")).toBeNull();
  });

  it("parses status with jobId arg", () => {
    const result = parseCommand("status abc-123");
    expect(result).toEqual({ command: "status", args: ["abc-123"] });
  });

  it("parses all known commands", () => {
    for (const cmd of [
      "help",
      "targets",
      "scantypes",
      "scan",
      "status",
      "history",
    ]) {
      expect(parseCommand(cmd)?.command).toBe(cmd);
    }
  });
});
