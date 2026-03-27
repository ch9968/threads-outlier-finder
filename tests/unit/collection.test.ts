import { describe, it, expect, vi, beforeEach } from "vitest";

function createChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.order = vi.fn().mockReturnValue(chain);
  return chain;
}

let mockChain = createChain();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}));

describe("Collection Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChain();
  });

  describe("toggleCollectionItem", () => {
    it("should reject invalid post ID", async () => {
      const { toggleCollectionItem } = await import(
        "../../src/lib/actions/collection"
      );

      const result = await toggleCollectionItem("not-a-uuid");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Invalid post ID");
    });

    it("should add to collection when not already collected", async () => {
      // Mock: not in collection
      mockChain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });
      // Mock: insert succeeds
      mockChain.insert = vi.fn().mockResolvedValue({ error: null });

      const { toggleCollectionItem } = await import(
        "../../src/lib/actions/collection"
      );

      const postId = "550e8400-e29b-41d4-a716-446655440000";
      const result = await toggleCollectionItem(postId);

      expect(result.data).toEqual({ isCollected: true });
      expect(result.error).toBeNull();
    });

    it("should remove from collection when already collected", async () => {
      // Mock: already in collection
      mockChain.single = vi.fn().mockResolvedValue({
        data: { id: "some-id" },
        error: null,
      });
      // Mock: delete succeeds
      mockChain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { toggleCollectionItem } = await import(
        "../../src/lib/actions/collection"
      );

      const postId = "550e8400-e29b-41d4-a716-446655440000";
      const result = await toggleCollectionItem(postId);

      expect(result.data).toEqual({ isCollected: false });
      expect(result.error).toBeNull();
    });
  });

  describe("removeFromCollection", () => {
    it("should reject invalid post ID", async () => {
      const { removeFromCollection } = await import(
        "../../src/lib/actions/collection"
      );

      const result = await removeFromCollection("invalid");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Invalid post ID");
    });

    it("should remove successfully with valid UUID", async () => {
      // Mock: delete succeeds
      mockChain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { removeFromCollection } = await import(
        "../../src/lib/actions/collection"
      );

      const postId = "550e8400-e29b-41d4-a716-446655440000";
      const result = await removeFromCollection(postId);

      expect(result.data).toEqual({ removed: true });
      expect(result.error).toBeNull();
    });
  });

  describe("getCollectionPostIds", () => {
    it("should return post IDs", async () => {
      const postIds = [
        { post_id: "id-1" },
        { post_id: "id-2" },
        { post_id: "id-3" },
      ];

      mockChain.select = vi.fn().mockResolvedValue({
        data: postIds,
        error: null,
      });

      const { getCollectionPostIds } = await import(
        "../../src/lib/actions/collection"
      );

      const result = await getCollectionPostIds();

      expect(result.data).toEqual(["id-1", "id-2", "id-3"]);
      expect(result.error).toBeNull();
    });

    it("should return empty array when no items", async () => {
      mockChain.select = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const { getCollectionPostIds } = await import(
        "../../src/lib/actions/collection"
      );

      const result = await getCollectionPostIds();

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("should handle database errors", async () => {
      mockChain.select = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      });

      const { getCollectionPostIds } = await import(
        "../../src/lib/actions/collection"
      );

      const result = await getCollectionPostIds();

      expect(result.data).toBeNull();
      expect(result.error).toBe("Failed to fetch collection");
    });
  });
});

describe("Zod validation", () => {
  it("should accept valid UUIDs", async () => {
    const { z } = await import("zod");
    const PostIdSchema = z.string().uuid("Invalid post ID");

    const validIds = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    ];

    for (const id of validIds) {
      expect(PostIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it("should reject invalid UUIDs", async () => {
    const { z } = await import("zod");
    const PostIdSchema = z.string().uuid("Invalid post ID");

    const invalidIds = ["not-a-uuid", "123", "", "abc-def-ghi"];

    for (const id of invalidIds) {
      const result = PostIdSchema.safeParse(id);
      expect(result.success).toBe(false);
    }
  });
});
