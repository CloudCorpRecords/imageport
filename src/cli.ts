#!/usr/bin/env node
/**
 * imageport CLI.
 *
 *   imageport metadata <input>
 *   imageport resize <input> <output> [--width n] [--height n]
 *   imageport convert <input> <output> <format>
 *   imageport crop <input> <output> <width> <height> <x> <y>
 *   imageport rotate <input> <output> <angle>
 *   imageport mcp
 *   imageport --version
 *
 * Exit codes: 0 success, 1 ImageMagick error, 2 usage error.
 */
import {
  convertImage,
  createDefaultExecutor,
  cropImage,
  getImageMetadata,
  resizeImage,
  rotateImage,
  VERSION,
} from "./imageport.js";

function usage(): never {
  console.error(`Usage:
  imageport metadata <input>
  imageport resize <input> <output> [--width n] [--height n]
  imageport convert <input> <output> <format>
  imageport crop <input> <output> <width> <height> <x> <y>
  imageport rotate <input> <output> <angle>
  imageport mcp
  imageport --version`);
  process.exit(2);
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function flagNumber(args: string[], name: string): number | undefined {
  const raw = flagValue(args, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) usage();
  return n;
}

function positional(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--width" || args[i] === "--height") i++;
    else out.push(args[i]);
  }
  return out;
}

function numArg(raw: string | undefined): number {
  if (raw === undefined) usage();
  const n = Number(raw);
  if (!Number.isFinite(n)) usage();
  return n;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const known = ["metadata", "resize", "convert", "crop", "rotate"];
  if (!known.includes(cmd)) usage();
  const exec = createDefaultExecutor();
  try {
    let out: unknown;
    if (cmd === "metadata") {
      const [input] = rest;
      if (!input) usage();
      out = await getImageMetadata(exec, { input });
    } else if (cmd === "resize") {
      const [input, output] = positional(rest);
      if (!input || !output) usage();
      out = await resizeImage(exec, {
        input,
        output,
        width: flagNumber(rest, "--width"),
        height: flagNumber(rest, "--height"),
      });
    } else if (cmd === "convert") {
      const [input, output, format] = rest;
      if (!input || !output || !format) usage();
      out = await convertImage(exec, { input, output, format });
    } else if (cmd === "crop") {
      const [input, output, w, h, x, y] = rest;
      if (!input || !output) usage();
      out = await cropImage(exec, {
        input,
        output,
        width: numArg(w),
        height: numArg(h),
        x: numArg(x),
        y: numArg(y),
      });
    } else {
      const [input, output, angle] = rest;
      if (!input || !output) usage();
      out = await rotateImage(exec, { input, output, angle: numArg(angle) });
    }
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
