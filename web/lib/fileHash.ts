/**
 * file hashing utilities using sHA-256 for content deduplication.
 * uses web workers for non-blocking hash computation on large files.
 */

// threshold for using web worker (files larger than this use worker)
const WORKER_THRESHOLD = 1024 * 1024; // 1mB

/**
 * compute sHA-256 hash of a file.
 * uses web worker for large files to avoid blocking the main thread.
 */
export async function computeFileHash(file: File): Promise<string> {
  // for small files, compute directly on main thread (faster due to no worker overhead)
  if (file.size < WORKER_THRESHOLD) {
    return computeHashDirect(file);
  }

  // for large files, use web worker
  return computeHashInWorker(file);
}

/**
 * compute hash directly on main thread (for small files).
 */
async function computeHashDirect(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToHex(hashBuffer);
}

/**
 * compute hash in a web worker (for large files).
 */
function computeHashInWorker(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // create inline worker from blob
    const workerCode = `
      self.onmessage = async (e) => {
        try {
          const file = e.data;
          const buffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
          self.postMessage({ success: true, hash: hashHex });
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);

      if (e.data.success) {
        resolve(e.data.hash);
      } else {
        reject(new Error(e.data.error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(error);
    };

    // send file to worker
    worker.postMessage(file);
  });
}

/**
 * convert arrayBuffer to hex string.
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
