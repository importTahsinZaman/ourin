import sharp from "sharp";

// Target sizes in raw bytes (before base64 encoding)
// Base64 adds ~33% overhead, so these targets ensure we stay under provider limits
const PROVIDER_TARGET_SIZES: Record<string, number> = {
  // Anthropic: 5MB base64 limit → 3.5MB raw target (safe margin)
  anthropic: 3.5 * 1024 * 1024,
  // OpenAI: 20MB limit, generous target
  openai: 15 * 1024 * 1024,
  // Google: 20MB limit, generous target
  google: 15 * 1024 * 1024,
};

const DEFAULT_TARGET_SIZE = 3.5 * 1024 * 1024;

// Maximum dimensions to start with (maintains quality while reducing size)
const MAX_DIMENSION = 2048;

interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  wasResized: boolean;
}

/**
 * Process an image to fit within a provider's size limits.
 * Resizes and compresses as needed while preserving quality.
 */
export async function processImageForProvider(
  imageBuffer: Buffer,
  mimeType: string,
  provider: string
): Promise<ProcessedImage> {
  const targetSize = PROVIDER_TARGET_SIZES[provider] || DEFAULT_TARGET_SIZE;

  // If already under limit, return as-is
  if (imageBuffer.length <= targetSize) {
    return { buffer: imageBuffer, mimeType, wasResized: false };
  }

  try {
    const metadata = await sharp(imageBuffer).metadata();
    const { width = 1000, height = 1000, hasAlpha = false } = metadata;

    // Determine output format: WebP for transparency, JPEG otherwise
    // (WebP has better compression and supports alpha)
    const outputFormat = hasAlpha ? "webp" : "jpeg";
    const outputMimeType = hasAlpha ? "image/webp" : "image/jpeg";

    // Calculate initial scaling based on file size ratio
    // Use square root because area scales with square of linear dimensions
    const sizeRatio = targetSize / imageBuffer.length;
    const dimensionScale = Math.sqrt(sizeRatio) * 0.9; // 0.9 for safety margin

    // Calculate new dimensions, capped at MAX_DIMENSION
    let newWidth = Math.min(Math.round(width * dimensionScale), MAX_DIMENSION);
    let newHeight = Math.min(
      Math.round(height * dimensionScale),
      MAX_DIMENSION
    );

    // Preserve aspect ratio if we hit MAX_DIMENSION cap
    if (width > height && newWidth === MAX_DIMENSION) {
      newHeight = Math.round((height / width) * MAX_DIMENSION);
    } else if (height > width && newHeight === MAX_DIMENSION) {
      newWidth = Math.round((width / height) * MAX_DIMENSION);
    }

    // Ensure minimum dimensions
    newWidth = Math.max(newWidth, 100);
    newHeight = Math.max(newHeight, 100);

    // Process with progressive quality reduction if needed
    let quality = 85;
    let outputBuffer: Buffer;

    do {
      const pipeline = sharp(imageBuffer).resize(newWidth, newHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });

      if (outputFormat === "jpeg") {
        outputBuffer = await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      } else {
        outputBuffer = await pipeline.webp({ quality }).toBuffer();
      }

      // If still too large and we have room to reduce quality, try again
      if (outputBuffer.length > targetSize && quality > 50) {
        quality -= 10;
        continue;
      }

      // If still too large after quality reduction, reduce dimensions more
      if (outputBuffer.length > targetSize && quality <= 50) {
        const additionalScale =
          Math.sqrt(targetSize / outputBuffer.length) * 0.85;
        newWidth = Math.max(Math.round(newWidth * additionalScale), 100);
        newHeight = Math.max(Math.round(newHeight * additionalScale), 100);
        quality = 70; // Reset quality for smaller dimensions
        continue;
      }

      break;
    } while (
      outputBuffer!.length > targetSize &&
      (quality > 50 || newWidth > 200)
    );

    console.log(
      `Image processed: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB → ${(outputBuffer!.length / 1024 / 1024).toFixed(2)}MB ` +
        `(${width}x${height} → ${newWidth}x${newHeight}, quality: ${quality})`
    );

    return {
      buffer: outputBuffer!,
      mimeType: outputMimeType,
      wasResized: true,
    };
  } catch (err) {
    console.error("Image processing failed, returning original:", err);
    // If processing fails, return original and let the API handle any errors
    return { buffer: imageBuffer, mimeType, wasResized: false };
  }
}

/**
 * Fetch an image from URL and process it for a provider.
 * Returns base64-encoded image data ready for the AI SDK.
 */
export async function fetchAndProcessImage(
  url: string,
  mimeType: string,
  provider: string,
  fileName?: string
): Promise<{ base64: string; mimeType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      `Fetched image: ${fileName || "unknown"} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`
    );

    // Process image to fit within provider limits
    const processed = await processImageForProvider(buffer, mimeType, provider);

    // Convert to base64
    const base64 = processed.buffer.toString("base64");

    return {
      base64,
      mimeType: processed.mimeType,
    };
  } finally {
    clearTimeout(timeout);
  }
}
