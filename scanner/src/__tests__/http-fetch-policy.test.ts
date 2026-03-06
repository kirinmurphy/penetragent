import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPage } from "../scanTypes/http/fetch-page.js";

describe("fetchPage outbound policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks cross-host redirects via verifyUrl policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", {
        status: 302,
        headers: {
          location: "https://evil.example.net/pivot",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPage("https://example.com", {
      trackRedirects: true,
      verifyUrl: async (url) => {
        if (url.hostname !== "example.com") {
          throw new Error(`Disallowed outbound host: ${url.hostname}`);
        }
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.page.statusCode).toBe(0);
    expect(result.page.contentIssues[0]).toContain("Disallowed outbound host");
  });

  it("allows same-host redirects when policy permits", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 302,
          headers: { location: "https://example.com/next" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html><body>ok</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPage("https://example.com", {
      trackRedirects: true,
      verifyUrl: async (url) => {
        if (url.hostname !== "example.com") {
          throw new Error("blocked");
        }
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.page.statusCode).toBe(200);
    expect(result.page.url).toBe("https://example.com/next");
  });
});
