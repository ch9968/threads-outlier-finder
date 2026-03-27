import { describe, it, expect } from "vitest";
import { cn } from "@/lib/cn";

describe("cn utility", () => {
  it("joins class strings with space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, "b", null, "c", undefined)).toBe("a b c");
  });

  it("returns empty string for all falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });

  it("handles single class", () => {
    expect(cn("only")).toBe("only");
  });
});
