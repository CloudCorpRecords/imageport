/**
 * imageport core: five local image tools over ImageMagick.
 *
 * This is a local image-processing server by design: there is no
 * hosted AI generation here and no result is ever fabricated. Each
 * tool builds the conventional ImageMagick argument array for the
 * job and runs it through an injectable ExecutorFn. Metadata uses
 * `identify` with a pipe-delimited -format string that is parsed
 * into typed fields; resize, convert, crop and rotate all drive
 * `convert`. The default executor spawns the real binaries via
 * node:child_process execFile (argument arrays, no shell) and wraps
 * any spawn failure — for example ENOENT when ImageMagick is not
 * installed — as an honest `image executor failed: <message>` error.
 */
import { execFile } from "node:child_process";
import type {
  ConvertImageOptions,
  ConvertImageResult,
  CropImageOptions,
  CropImageResult,
  ExecutorFn,
  GetImageMetadataOptions,
  ImageMetadata,
  ResizeImageOptions,
  ResizeImageResult,
  RotateImageOptions,
  RotateImageResult,
} from "./types.js";

export const VERSION = "0.1.0";

/** Formats the convert tool accepts (lowercase, no dot). */
export const ALLOWED_FORMATS = ["png", "jpg", "webp", "gif", "avif", "bmp", "tiff"] as const;

/**
 * Default executor: execFile with an argument array (no shell).
 * Any failure is wrapped so callers see one honest error shape.
 */
export function createDefaultExecutor(): ExecutorFn {
  return (command: string, args: string[]) =>
    new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(command, args, { timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`image executor failed: ${err.message}`));
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      });
    });
}

function need(value: string | undefined, field: string): string {
  if (!value) throw new Error(`${field} is required`);
  return value;
}

/**
 * Read metadata for an image file via
 * `identify -format "%m|%w|%h|%[colorspace]|%b" <input>`.
 * The pipe-delimited line is parsed into typed fields; output that
 * does not parse is an error, never a partial guess.
 */
export async function getImageMetadata(
  exec: ExecutorFn,
  options: GetImageMetadataOptions,
): Promise<ImageMetadata> {
  const input = need(options.input, "input");
  const { stdout } = await exec("identify", ["-format", "%m|%w|%h|%[colorspace]|%b", input]);
  const line = stdout.trim().split("\n")[0] ?? "";
  const parts = line.split("|");
  if (parts.length !== 5) {
    throw new Error(`identify returned unparseable output for ${input}: ${line}`);
  }
  const [format, widthRaw, heightRaw, colorSpace, fileSize] = parts;
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!format || !Number.isFinite(width) || !Number.isFinite(height) || !colorSpace || !fileSize) {
    throw new Error(`identify returned unparseable output for ${input}: ${line}`);
  }
  return { input, format, width, height, colorSpace, fileSize };
}

/**
 * Resize preserving aspect ratio. At least one of width / height is
 * required; the geometry string is `WxH`, `Wx` or `xH` accordingly.
 */
export async function resizeImage(
  exec: ExecutorFn,
  options: ResizeImageOptions,
): Promise<ResizeImageResult> {
  const input = need(options.input, "input");
  const output = need(options.output, "output");
  const { width, height } = options;
  if (width === undefined && height === undefined) {
    throw new Error("at least one of width and height is required");
  }
  if (width !== undefined && width <= 0) throw new Error("width must be > 0");
  if (height !== undefined && height <= 0) throw new Error("height must be > 0");
  const geometry =
    width !== undefined && height !== undefined
      ? `${width}x${height}`
      : width !== undefined
        ? `${width}x`
        : `x${height}`;
  await exec("convert", [input, "-resize", geometry, output]);
  return { input, output, width: width ?? null, height: height ?? null };
}

/**
 * Convert to another format. ImageMagick picks the output format
 * from the output file's extension, so the effective output path is
 * the requested output with its extension replaced by the target
 * format whenever the two differ (an extensionless output gains the
 * format as its extension). The returned `output` is that effective
 * path — the file actually written.
 */
export async function convertImage(
  exec: ExecutorFn,
  options: ConvertImageOptions,
): Promise<ConvertImageResult> {
  const input = need(options.input, "input");
  const output = need(options.output, "output");
  const formatRaw = need(options.format, "format");
  const format = formatRaw.toLowerCase();
  if (!(ALLOWED_FORMATS as readonly string[]).includes(format)) {
    throw new Error(
      `unsupported format "${formatRaw}": allowed formats are ${ALLOWED_FORMATS.join(", ")}`,
    );
  }
  const dot = output.lastIndexOf(".");
  const slash = Math.max(output.lastIndexOf("/"), output.lastIndexOf("\\"));
  const effectiveOutput =
    dot > slash ? `${output.slice(0, dot)}.${format}` : `${output}.${format}`;
  await exec("convert", [input, effectiveOutput]);
  return { input, output: effectiveOutput, format };
}

/**
 * Crop a width x height region starting at offset x, y. `+repage`
 * resets the virtual canvas so the written file starts at the crop
 * origin.
 */
export async function cropImage(
  exec: ExecutorFn,
  options: CropImageOptions,
): Promise<CropImageResult> {
  const input = need(options.input, "input");
  const output = need(options.output, "output");
  const { width, height, x, y } = options;
  if (!(width > 0) || !(height > 0)) throw new Error("width and height must be > 0");
  if (!(x >= 0) || !(y >= 0)) throw new Error("x and y must be >= 0");
  await exec("convert", [input, "-crop", `${width}x${height}+${x}+${y}`, "+repage", output]);
  return { input, output, width, height, x, y };
}

/** Rotate by the given angle in degrees. */
export async function rotateImage(
  exec: ExecutorFn,
  options: RotateImageOptions,
): Promise<RotateImageResult> {
  const input = need(options.input, "input");
  const output = need(options.output, "output");
  const { angle } = options;
  await exec("convert", [input, "-rotate", String(angle), output]);
  return { input, output, angle };
}
