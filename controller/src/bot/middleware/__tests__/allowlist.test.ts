import { describe, it, expect, vi } from "vitest";
import type { Context } from "grammy";
import { allowlistMiddleware } from "../allowlist.js";

describe("allowlistMiddleware", () => {
  const allowedUserId = "123456789";
  const middleware = allowlistMiddleware(allowedUserId);

  it("should allow messages from the allowlisted user", async () => {
    const ctx = {
      from: { id: 123456789 },
      reply: vi.fn(),
    } as unknown as Context;

    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("should silently drop messages from non-allowlisted users", async () => {
    const ctx = {
      from: { id: 987654321 },
      reply: vi.fn(),
    } as unknown as Context;

    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled(); // Silently drops
  });

  it("should silently drop messages when from is undefined", async () => {
    const ctx = {
      from: undefined,
      reply: vi.fn(),
    } as unknown as Context;

    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled(); // Silently drops
  });

  it("should handle numeric user ID correctly", async () => {
    const ctx = {
      from: { id: 123456789 },
      reply: vi.fn(),
    } as unknown as Context;

    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("should silently drop when user ID does not match as string", async () => {
    const ctx = {
      from: { id: 123456788 }, // Off by one
      reply: vi.fn(),
    } as unknown as Context;

    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled(); // Silently drops
  });
});
