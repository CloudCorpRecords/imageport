/**
 * imageport types.
 *
 * Every tool takes an input path and, except for metadata, an output
 * path. All work runs through an injectable executor: a function
 * that takes a command name ("convert" or "identify") plus an
 * argument array and resolves with the captured stdout and stderr.
 * The default executor spawns the real ImageMagick binaries with
 * node:child_process execFile (argument arrays, never a shell);
 * tests inject a fake that records the arrays and returns canned
 * output, so no test needs ImageMagick installed.
 */

/** Runs a binary with an argument array; resolves with its output. */
export type ExecutorFn = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export interface GetImageMetadataOptions {
  input: string;
}

export interface ResizeImageOptions {
  input: string;
  output: string;
  width?: number;
  height?: number;
}

export interface ConvertImageOptions {
  input: string;
  output: string;
  format: string;
}

export interface CropImageOptions {
  input: string;
  output: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface RotateImageOptions {
  input: string;
  output: string;
  angle: number;
}

/** Parsed result of the metadata tool. */
export interface ImageMetadata {
  input: string;
  format: string;
  width: number;
  height: number;
  colorSpace: string;
  fileSize: string;
}

export interface ResizeImageResult {
  input: string;
  output: string;
  width: number | null;
  height: number | null;
}

export interface ConvertImageResult {
  input: string;
  output: string;
  format: string;
}

export interface CropImageResult {
  input: string;
  output: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface RotateImageResult {
  input: string;
  output: string;
  angle: number;
}
