import sharp from "sharp";

// target sizes in raw bytes (before base64 encoding)
// base64 adds ~33% overhead, so these targets ensure we stay under provider limits
const PROVIDER_TARGET_SIZES: Record<string, number> = {
  // anthropic: 5mB base64 limit → 3.5mB raw target (safe margin)
  anthropic: 3.5 * 1024 * 1024,
  // openAI: 20mB limit, generous target
  openai: 15 * 1024 * 1024,
  // google: 20mB limit, generous target
  google: 15 * 1024 * 1024,
};

const DEFAULT_TARGET_SIZE = 3.5 * 1024 * 1024;

// maximum dimensions to start with (maintains quality while reducing size)
const MAX_DIMENSION = 2048;

interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  wasResized: boolean;
}

/**
 * process an image to fit within a provider's size limits.
 * resizes and compresses as needed while preserving quality.
 */
export async function processImageForProvider(
  imageBuffer: Buffer,
  mimeType: string,
  provider: string
): Promise<ProcessedImage> {
  const targetSize = PROVIDER_TARGET_SIZES[provider] || DEFAULT_TARGET_SIZE;

  // if already under limit, return as-is
  if (imageBuffer.length <= targetSize) {
    return { buffer: imageBuffer, mimeType, wasResized: false };
  }

  try {
    const metadata = await sharp(imageBuffer).metadata();
    const { width = 1000, height = 1000, hasAlpha = false } = metadata;

    // determine output format: webP for transparency, jPEG otherwise
    // (webP has better compression and supports alpha)
    const outputFormat = hasAlpha ? "webp" : "jpeg";
    const outputMimeType = hasAlpha ? "image/webp" : "image/jpeg";

    // calculate initial scaling based on file size ratio
    // use square root because area scales with square of linear dimensions
    const sizeRatio = targetSize / imageBuffer.length;
    const dimensionScale = Math.sqrt(sizeRatio) * 0.9; // 0.9 for safety margin

    // calculate new dimensions, capped at mAX_dIMENSION
    let newWidth = Math.min(Math.round(width * dimensionScale), MAX_DIMENSION);
    let newHeight = Math.min(
      Math.round(height * dimensionScale),
      MAX_DIMENSION
    );

    // preserve aspect ratio if we hit mAX_dIMENSION cap
    if (width > height && newWidth === MAX_DIMENSION) {
      newHeight = Math.round((height / width) * MAX_DIMENSION);
    } else if (height > width && newHeight === MAX_DIMENSION) {
      newWidth = Math.round((width / height) * MAX_DIMENSION);
    }

    // ensure minimum dimensions
    newWidth = Math.max(newWidth, 100);
    newHeight = Math.max(newHeight, 100);

    // process with progressive quality reduction if needed
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

      // if still too large and we have room to reduce quality, try again
      if (outputBuffer.length > targetSize && quality > 50) {
        quality -= 10;
        continue;
      }

      // if still too large after quality reduction, reduce dimensions more
      if (outputBuffer.length > targetSize && quality <= 50) {
        const additionalScale =
          Math.sqrt(targetSize / outputBuffer.length) * 0.85;
        newWidth = Math.max(Math.round(newWidth * additionalScale), 100);
        newHeight = Math.max(Math.round(newHeight * additionalScale), 100);
        quality = 70; // reset quality for smaller dimensions
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
    // if processing fails, return original and let the aPI handle any errors
    return { buffer: imageBuffer, mimeType, wasResized: false };
  }
}

/**
 * fetch an image from uRL and process it for a provider.
 * returns base64-encoded image data ready for the aI sDK.
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

    // process image to fit within provider limits
    const processed = await processImageForProvider(buffer, mimeType, provider);

    // convert to base64
    const base64 = processed.buffer.toString("base64");

    return {
      base64,
      mimeType: processed.mimeType,
    };
  } finally {
    clearTimeout(timeout);
  }
}
