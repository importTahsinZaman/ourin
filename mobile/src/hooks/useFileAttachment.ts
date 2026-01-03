import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { FilePart } from "@ourin/shared/types";

export interface PendingFile {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
  isUploading: boolean;
  uploadProgress: number;
  storageId?: string;
  url?: string;
  error?: string;
}

export function useFileAttachment() {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileReference = useMutation(api.files.saveFileReference);

  // Compute SHA-256 hash for deduplication
  const computeHash = async (uri: string): Promise<string> => {
    try {
      const file = new File(uri);
      const content = await file.text();
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        content
      );
      return hash;
    } catch {
      // Return random ID if hashing fails
      return Crypto.randomUUID();
    }
  };

  // Get file category based on mime type
  const getCategory = (
    mimeType: string
  ): "image" | "document" | "screenshot" | "drawing" => {
    if (mimeType.startsWith("image/")) return "image";
    return "document";
  };

  // Upload a single file to Convex storage
  const uploadFile = async (file: PendingFile): Promise<PendingFile> => {
    try {
      // Update status to uploading
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, isUploading: true, error: undefined } : f
        )
      );

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Read file as blob
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // Upload to Convex storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.mimeType,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const { storageId } = await uploadResponse.json();

      // Compute content hash
      const contentHash = await computeHash(file.uri);

      // Save file reference
      const result = await saveFileReference({
        storageId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
        category: getCategory(file.mimeType),
        contentHash,
      });

      const updatedFile: PendingFile = {
        ...file,
        isUploading: false,
        uploadProgress: 100,
        storageId: result.storageId,
        url: result.url ?? undefined,
      };

      setPendingFiles((prev) =>
        prev.map((f) => (f.id === file.id ? updatedFile : f))
      );

      return updatedFile;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, isUploading: false, error: errorMessage }
            : f
        )
      );

      throw error;
    }
  };

  // Request camera permission and take photo
  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to take photos."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;

      const newFile: PendingFile = {
        id: Crypto.randomUUID(),
        uri: asset.uri,
        fileName,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize || 0,
        isUploading: false,
        uploadProgress: 0,
      };

      setPendingFiles((prev) => [...prev, newFile]);

      // Start upload immediately
      await uploadFile(newFile);
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  }, []);

  // Request photo library permission and pick image
  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Photo library permission is needed to select images."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const newFiles: PendingFile[] = result.assets.map((asset) => ({
        id: Crypto.randomUUID(),
        uri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize || 0,
        isUploading: false,
        uploadProgress: 0,
      }));

      setPendingFiles((prev) => [...prev, ...newFiles]);

      // Upload all files
      await Promise.all(newFiles.map(uploadFile));
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image");
    }
  }, []);

  // Pick document
  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain", "text/markdown"],
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const newFiles: PendingFile[] = result.assets.map((asset) => ({
        id: Crypto.randomUUID(),
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        size: asset.size || 0,
        isUploading: false,
        uploadProgress: 0,
      }));

      setPendingFiles((prev) => [...prev, ...newFiles]);

      // Upload all files
      await Promise.all(newFiles.map(uploadFile));
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to select document");
    }
  }, []);

  // Remove a pending file
  const removeFile = useCallback((fileId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Clear all pending files
  const clearFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  // Convert pending files to FileParts for message
  const getFileParts = useCallback((): FilePart[] => {
    return pendingFiles
      .filter((f) => f.storageId && !f.error)
      .map((f) => ({
        type: "file" as const,
        mediaType: f.mimeType,
        url: f.url,
        storageId: f.storageId,
        fileName: f.fileName,
        fileSize: f.size,
      }));
  }, [pendingFiles]);

  // Check if any files are still uploading
  const isUploading = pendingFiles.some((f) => f.isUploading);

  // Check if there are any files ready to send
  const hasFiles = pendingFiles.some((f) => f.storageId && !f.error);

  return {
    pendingFiles,
    isUploading,
    hasFiles,
    isPickerOpen,
    setIsPickerOpen,
    takePhoto,
    pickImage,
    pickDocument,
    removeFile,
    clearFiles,
    getFileParts,
  };
}
