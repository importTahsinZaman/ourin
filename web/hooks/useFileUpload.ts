"use client";

import { useCallback } from "react";
import { useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatFileSize, isImageFile } from "@/lib/utils";
import { computeFileHash } from "@/lib/fileHash";
import type { Attachment } from "./useDraft";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  // Office
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export { MAX_FILE_SIZE, ALLOWED_TYPES };

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
    };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "File type not supported" };
  }
  return { valid: true };
}

/**
 * Determines if an attachment should be deleted from storage when removed from draft.
 *
 * Returns true only if:
 * - Attachment has a storageId
 * - Not a duplicate (file existed before this session, e.g., sent in previous chat)
 * - No other attachments in the current draft share the same storageId
 */
export function shouldDeleteFromStorage(
  attachment: Attachment,
  allAttachments: Attachment[]
): boolean {
  // No storageId means nothing to delete
  if (!attachment.storageId) return false;

  // Duplicate files already existed in storage (sent in previous chat, etc.)
  // They should not be deleted when removed from draft
  if (attachment.isDuplicate) return false;

  // Check if other attachments in the draft share the same storageId
  // (e.g., user attached the same new file multiple times)
  const othersWithSameStorage = allAttachments.filter(
    (a) => a.id !== attachment.id && a.storageId === attachment.storageId
  );

  // Only delete if this is the last attachment using this storageId
  return othersWithSameStorage.length === 0;
}

export type FileCategory = "screenshot" | "drawing" | "image" | "document";

interface UseFileUploadReturn {
  processFile: (
    attachment: Attachment,
    category?: FileCategory
  ) => Promise<Attachment>;
  uploadFile: (
    attachment: Attachment,
    category?: FileCategory,
    contentHash?: string
  ) => Promise<Attachment>;
  deleteFile: (storageId: Id<"_storage">) => Promise<void>;
  checkDuplicate: (
    contentHash: string
  ) => Promise<{ storageId: Id<"_storage">; url: string } | null>;
}

export function useFileUpload(): UseFileUploadReturn {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileReference = useMutation(api.files.saveFileReference);
  const deleteFileMutation = useMutation(api.files.deleteFile);

  const checkDuplicate = useCallback(
    async (
      contentHash: string
    ): Promise<{ storageId: Id<"_storage">; url: string } | null> => {
      try {
        const existing = await convex.query(api.files.findByContentHash, {
          contentHash,
        });
        if (existing) {
          return { storageId: existing.storageId, url: existing.url ?? "" };
        }
        return null;
      } catch {
        return null;
      }
    },
    [convex]
  );

  const uploadFile = useCallback(
    async (
      attachment: Attachment,
      category?: FileCategory,
      contentHash?: string
    ): Promise<Attachment> => {
      try {
        const uploadUrl = await generateUploadUrl();

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": attachment.file.type },
          body: attachment.file,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = await response.json();

        const fileCategory =
          category ??
          (isImageFile(attachment.file.type) ? "image" : "document");

        const result = await saveFileReference({
          storageId,
          fileName: attachment.file.name,
          mimeType: attachment.file.type,
          size: attachment.file.size,
          category: fileCategory,
          contentHash,
        });

        return {
          ...attachment,
          status: "ready",
          storageId: result.storageId,
          url: result.url ?? undefined,
          contentHash,
        };
      } catch {
        return {
          ...attachment,
          status: "error",
          error: "Upload failed",
        };
      }
    },
    [generateUploadUrl, saveFileReference]
  );

  const processFile = useCallback(
    async (
      attachment: Attachment,
      category?: FileCategory
    ): Promise<Attachment> => {
      try {
        const contentHash = await computeFileHash(attachment.file);
        const existing = await checkDuplicate(contentHash);

        if (existing) {
          return {
            ...attachment,
            status: "ready",
            storageId: existing.storageId,
            url: existing.url,
            contentHash,
            isDuplicate: true,
          };
        }

        return uploadFile(
          { ...attachment, status: "uploading" },
          category,
          contentHash
        );
      } catch (error) {
        console.warn("Hash computation failed, uploading directly:", error);
        return uploadFile(attachment, category);
      }
    },
    [checkDuplicate, uploadFile]
  );

  const deleteFile = useCallback(
    async (storageId: Id<"_storage">) => {
      try {
        await deleteFileMutation({ storageId });
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    },
    [deleteFileMutation]
  );

  return {
    processFile,
    uploadFile,
    deleteFile,
    checkDuplicate,
  };
}
