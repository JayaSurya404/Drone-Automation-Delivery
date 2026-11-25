import { detectImageType } from "./file-upload.util";

function bytes(...values: number[]): Buffer {
  return Buffer.from(values);
}

describe("detectImageType", () => {
  it("detects a JPEG by its magic number", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toEqual({ mime: "image/jpeg", extension: "jpg" });
  });

  it("detects a PNG by its magic number", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00))).toEqual({ mime: "image/png", extension: "png" });
  });

  it("detects a WebP by its RIFF/WEBP header", () => {
    const buffer = Buffer.concat([Buffer.from("RIFF", "ascii"), bytes(0, 0, 0, 0), Buffer.from("WEBP", "ascii")]);
    expect(detectImageType(buffer)).toEqual({ mime: "image/webp", extension: "webp" });
  });

  it("returns null for an SVG (deliberately never accepted — stored-XSS risk)", () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "utf-8");
    expect(detectImageType(svg)).toBeNull();
  });

  it("returns null for a GIF (not in the allow-list)", () => {
    expect(detectImageType(Buffer.from("GIF89a", "ascii"))).toBeNull();
  });

  it("returns null when the claimed type doesn't match the actual bytes (e.g. a renamed .exe)", () => {
    const fakeJpeg = Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "binary");
    expect(detectImageType(fakeJpeg)).toBeNull();
  });

  it("returns null for an empty or truncated buffer", () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});
