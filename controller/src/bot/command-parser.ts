export interface ParsedCommand {
  command: string;
  args: string[];
}

const KNOWN_COMMANDS = new Set([
  "help",
  "targets",
  "scantypes",
  "scan",
  "status",
  "history",
]);

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Remove leading / if present
  const cleaned = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (!cleaned) return null;

  const parts = cleaned.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (!KNOWN_COMMANDS.has(command)) {
    return null;
  }

  return {
    command,
    args: parts.slice(1),
  };
}
