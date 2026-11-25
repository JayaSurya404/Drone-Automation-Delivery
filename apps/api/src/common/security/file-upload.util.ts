/**
 * Phase 12 security fix — file uploads (`catalog.service.ts`'s product
 * images, `delivery.service.ts`'s proof-of-delivery photos) previously
 * trusted the client-supplied `Content-Type` header and spliced the
 * client-supplied filename's extension straight into the storage key, with
 * no size limit anywhere. All three are real gaps:
 *  - `Content-Type` is fully attacker-controlled in multipart form data — a
 *    request can claim `image/jpeg` while uploading anything.
 *  - An `image/svg+xml` upload containing an embedded `<script>`, served
 *    back inline with the browser's own MIME sniffing, is a stored-XSS
 *    vector — SVG is deliberately not in the allow-list below at all.
 *  - `originalname.split(".").pop()` on a crafted filename (e.g.
 *    `x.jpg/../../evil`) can inject `/`/`..` into the storage key.
 *
 * Rather than pull in a general-purpose file-type-sniffing library (most
 * are ESM-only, awkward in this CommonJS app, and massive overkill for the
 * exactly three formats this app ever needs to accept), this hand-checks
 * the well-known magic-number byte signatures for JPEG/PNG/WebP — the
 * extension used in the storage key always comes from the *detected* type,
 * never the client-supplied filename.
 */

export interface DetectedImageType {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

/** 5 MiB — generous for a product photo or a proof-of-delivery snapshot, small enough that a burst of uploads can't meaningfully exhaust server memory (Multer's default in-memory storage buffers the whole file before this check ever runs). */
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

/** Returns the detected type for a genuine JPEG/PNG/WebP file, or `null` for anything else (including a mismatched claim, a corrupt file, or a disallowed format like SVG/GIF). Never trusts `mimetype`/`originalname` — only the file's own leading bytes. */
export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}
