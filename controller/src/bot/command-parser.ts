import { COMMAND } from "./constants.js";

export type CommandName = (typeof COMMAND)[keyof typeof COMMAND];

export interface ParsedCommand {
  command: CommandName;
  args: string[];
}

const KNOWN_COMMANDS = new Set<string>(Object.values(COMMAND));

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (!cleaned) return null;

  const parts = cleaned.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (!KNOWN_COMMANDS.has(command)) {
    return null;
  }

  return {
    command: command as CommandName,
    args: parts.slice(1),
  };
}
