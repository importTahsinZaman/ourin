import { describe, it, expect } from "vitest";
import { shouldDeleteFromStorage, validateFile } from "@/hooks/useFileUpload";
import type { Attachment } from "@/hooks/useDraft";
import type { Id } from "@/convex/_generated/dataModel";

// helper to create a mock attachment
function createAttachment(
  overrides: Partial<Attachment> & { id: string }
): Attachment {
  return {
    file: new File(["test"], "test.png", { type: "image/png" }),
    status: "ready",
    ...overrides,
  };
}

describe("shouldDeleteFromStorage", () => {
  describe("returns false (should NOT delete)", () => {
    it("when attachment has no storageId", () => {
      const attachment = createAttachment({ id: "1" });
      expect(shouldDeleteFromStorage(attachment, [attachment])).toBe(false);
    });

    it("when attachment is a duplicate (existed before this session)", () => {
      const attachment = createAttachment({
        id: "1",
        storageId: "storage123" as Id<"_storage">,
        isDuplicate: true,
      });
      expect(shouldDeleteFromStorage(attachment, [attachment])).toBe(false);
    });

    it("when other attachments share the same storageId", () => {
      const storageId = "storage123" as Id<"_storage">;
      const attachment1 = createAttachment({ id: "1", storageId });
      const attachment2 = createAttachment({ id: "2", storageId });
      const allAttachments = [attachment1, attachment2];

      // removing attachment1 - attachment2 still uses the same storageId
      expect(shouldDeleteFromStorage(attachment1, allAttachments)).toBe(false);
      // removing attachment2 - attachment1 still uses the same storageId
      expect(shouldDeleteFromStorage(attachment2, allAttachments)).toBe(false);
    });

    it("when multiple attachments share storageId (3 copies)", () => {
      const storageId = "storage123" as Id<"_storage">;
      const attachment1 = createAttachment({ id: "1", storageId });
      const attachment2 = createAttachment({ id: "2", storageId });
      const attachment3 = createAttachment({ id: "3", storageId });
      const allAttachments = [attachment1, attachment2, attachment3];

      expect(shouldDeleteFromStorage(attachment1, allAttachments)).toBe(false);
      expect(shouldDeleteFromStorage(attachment2, allAttachments)).toBe(false);
      expect(shouldDeleteFromStorage(attachment3, allAttachments)).toBe(false);
    });
  });

  describe("returns true (should delete)", () => {
    it("when attachment is fresh upload and is the only one", () => {
      const attachment = createAttachment({
        id: "1",
        storageId: "storage123" as Id<"_storage">,
      });
      expect(shouldDeleteFromStorage(attachment, [attachment])).toBe(true);
    });

    it("when attachment is the last one with its storageId", () => {
      const storageId1 = "storage123" as Id<"_storage">;
      const storageId2 = "storage456" as Id<"_storage">;
      const attachment1 = createAttachment({ id: "1", storageId: storageId1 });
      const attachment2 = createAttachment({ id: "2", storageId: storageId2 });
      const allAttachments = [attachment1, attachment2];

      // each has unique storageId, so both should be deletable
      expect(shouldDeleteFromStorage(attachment1, allAttachments)).toBe(true);
      expect(shouldDeleteFromStorage(attachment2, allAttachments)).toBe(true);
    });

    it("when other attachments exist but have different storageIds", () => {
      const attachment1 = createAttachment({
        id: "1",
        storageId: "storage123" as Id<"_storage">,
      });
      const attachment2 = createAttachment({
        id: "2",
        storageId: "storage456" as Id<"_storage">,
      });
      const attachment3 = createAttachment({
        id: "3",
        storageId: "storage789" as Id<"_storage">,
      });
      const allAttachments = [attachment1, attachment2, attachment3];

      expect(shouldDeleteFromStorage(attachment1, allAttachments)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty attachments array (attachment not in list)", () => {
      const attachment = createAttachment({
        id: "1",
        storageId: "storage123" as Id<"_storage">,
      });
      // attachment not in the list - should still return true based on logic
      expect(shouldDeleteFromStorage(attachment, [])).toBe(true);
    });

    it("handles attachment without storageId in the list", () => {
      const attachment1 = createAttachment({
        id: "1",
        storageId: "storage123" as Id<"_storage">,
      });
      const attachment2 = createAttachment({ id: "2" }); // no storageId
      const allAttachments = [attachment1, attachment2];

      expect(shouldDeleteFromStorage(attachment1, allAttachments)).toBe(true);
    });

    it("correctly identifies when duplicates are removed one by one", () => {
      const storageId = "storage123" as Id<"_storage">;

      // start with 3 copies
      const a1 = createAttachment({ id: "1", storageId });
      const a2 = createAttachment({ id: "2", storageId });
      const a3 = createAttachment({ id: "3", storageId });

      // remove first - 2 remain, don't delete
      expect(shouldDeleteFromStorage(a1, [a1, a2, a3])).toBe(false);

      // after a1 removed, check a2 with [a2, a3] - still don't delete
      expect(shouldDeleteFromStorage(a2, [a2, a3])).toBe(false);

      // after a2 removed, check a3 with [a3] - now delete
      expect(shouldDeleteFromStorage(a3, [a3])).toBe(true);
    });
  });
});

describe("validateFile", () => {
  it("accepts valid image file", () => {
    const file = new File(["test"], "test.png", { type: "image/png" });
    expect(validateFile(file)).toEqual({ valid: true });
  });

  it("accepts valid PDF file", () => {
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    expect(validateFile(file)).toEqual({ valid: true });
  });

  it("rejects unsupported file type", () => {
    const file = new File(["test"], "test.exe", {
      type: "application/x-msdownload",
    });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File type not supported");
  });

  it("rejects file exceeding size limit", () => {
    // create a file larger than 25mB
    const largeContent = new Array(26 * 1024 * 1024).fill("a").join("");
    const file = new File([largeContent], "large.png", { type: "image/png" });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File must be less than");
  });

  it("accepts file at exactly the size limit", () => {
    // create a file exactly at 25mB
    const content = new Array(25 * 1024 * 1024).fill("a").join("");
    const file = new File([content], "exact.png", { type: "image/png" });
    expect(validateFile(file)).toEqual({ valid: true });
  });
});
