import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env before importing middleware
vi.stubEnv("SITE_PASSWORD", "test-password-123");

// We test the pure functions exported from middleware.
// The actual Next.js middleware function needs NextRequest which is complex to mock.
import { getExpectedToken, COOKIE_NAME } from "@/middleware";

describe("middleware", () => {
  describe("COOKIE_NAME", () => {
    it("is santiago-auth", () => {
      expect(COOKIE_NAME).toBe("santiago-auth");
    });
  });

  describe("getExpectedToken", () => {
    it("generates a deterministic token from SITE_PASSWORD", () => {
      const token1 = getExpectedToken();
      const token2 = getExpectedToken();
      expect(token1).toBe(token2);
    });

    it("starts with s_ prefix", () => {
      const token = getExpectedToken();
      expect(token).toMatch(/^s_/);
    });

    it("throws when SITE_PASSWORD is missing", () => {
      const original = process.env.SITE_PASSWORD;
      delete process.env.SITE_PASSWORD;
      expect(() => getExpectedToken()).toThrow("Missing SITE_PASSWORD");
      process.env.SITE_PASSWORD = original;
    });
  });
});
