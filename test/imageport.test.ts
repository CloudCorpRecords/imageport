import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertImage,
  cropImage,
  getImageMetadata,
  resizeImage,
  rotateImage,
} from "../src/imageport.js";
import type { ExecutorFn } from "../src/types.js";

/** Fake executor: records every call, returns canned identify output. */
function makeFake(stdout = "PNG|800|600|sRGB|12.3KB") {
  const calls: Array<{ command: string; args: string[] }> = [];
  const exec: ExecutorFn = async (command, args) => {
    calls.push({ command, args });
    return { stdout, stderr: "" };
  };
  return { exec, calls };
}

describe("imageport core", () => {
  it("metadata parses canned identify output and asserts exact args", async () => {
    const { exec, calls } = makeFake();
    const meta = await getImageMetadata(exec, { input: "/tmp/photo.png" });
    assert.equal(meta.input, "/tmp/photo.png");
    assert.equal(meta.format, "PNG");
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 600);
    assert.equal(meta.colorSpace, "sRGB");
    assert.equal(meta.fileSize, "12.3KB");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "identify");
    assert.deepEqual(calls[0].args, [
      "-format",
      "%m|%w|%h|%[colorspace]|%b",
      "/tmp/photo.png",
    ]);
  });

  it("metadata rejects unparseable identify output", async () => {
    const { exec } = makeFake("garbage-without-pipes");
    await assert.rejects(
      () => getImageMetadata(exec, { input: "/tmp/x.png" }),
      /unparseable/,
    );
  });

  it("resize with both dimensions builds WxH geometry", async () => {
    const { exec, calls } = makeFake();
    const r = await resizeImage(exec, {
      input: "/tmp/a.png",
      output: "/tmp/b.png",
      width: 400,
      height: 300,
    });
    assert.deepEqual(calls[0].args, ["/tmp/a.png", "-resize", "400x300", "/tmp/b.png"]);
    assert.equal(calls[0].command, "convert");
    assert.deepEqual(r, { input: "/tmp/a.png", output: "/tmp/b.png", width: 400, height: 300 });
  });

  it("resize with width only builds Wx geometry and null height", async () => {
    const { exec, calls } = makeFake();
    const r = await resizeImage(exec, {
      input: "/tmp/a.png",
      output: "/tmp/b.png",
      width: 200,
    });
    assert.deepEqual(calls[0].args, ["/tmp/a.png", "-resize", "200x", "/tmp/b.png"]);
    assert.equal(r.width, 200);
    assert.equal(r.height, null);
  });

  it("resize with height only builds xH geometry and null width", async () => {
    const { exec, calls } = makeFake();
    const r = await resizeImage(exec, {
      input: "/tmp/a.png",
      output: "/tmp/b.png",
      height: 150,
    });
    assert.deepEqual(calls[0].args, ["/tmp/a.png", "-resize", "x150", "/tmp/b.png"]);
    assert.equal(r.width, null);
    assert.equal(r.height, 150);
  });

  it("resize with neither dimension errors and never calls the executor", async () => {
    const { exec, calls } = makeFake();
    await assert.rejects(
      () => resizeImage(exec, { input: "/tmp/a.png", output: "/tmp/b.png" }),
      /at least one of width and height/,
    );
    assert.equal(calls.length, 0);
  });

  it("convert rejects an unsupported format and lists the allowed formats", async () => {
    const { exec, calls } = makeFake();
    await assert.rejects(
      () =>
        convertImage(exec, { input: "/tmp/a.png", output: "/tmp/a.tga", format: "tga" }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /allowed formats are/);
        assert.match(err.message, /png/);
        assert.match(err.message, /webp/);
        assert.match(err.message, /tiff/);
        return true;
      },
    );
    assert.equal(calls.length, 0);
  });

  it("convert replaces the output extension with the target format", async () => {
    const { exec, calls } = makeFake();
    const r = await convertImage(exec, {
      input: "/tmp/photo.png",
      output: "/tmp/photo.png",
      format: "webp",
    });
    assert.deepEqual(calls[0].args, ["/tmp/photo.png", "/tmp/photo.webp"]);
    assert.equal(calls[0].command, "convert");
    assert.equal(r.output, "/tmp/photo.webp");
    assert.equal(r.format, "webp");
  });

  it("convert keeps the output path when the extension already matches (case-insensitive format)", async () => {
    const { exec, calls } = makeFake();
    const r = await convertImage(exec, {
      input: "/tmp/photo.png",
      output: "/tmp/photo.jpg",
      format: "JPG",
    });
    assert.deepEqual(calls[0].args, ["/tmp/photo.png", "/tmp/photo.jpg"]);
    assert.equal(r.output, "/tmp/photo.jpg");
    assert.equal(r.format, "jpg");
  });

  it("crop builds the geometry with +repage", async () => {
    const { exec, calls } = makeFake();
    const r = await cropImage(exec, {
      input: "/tmp/a.png",
      output: "/tmp/b.png",
      width: 100,
      height: 50,
      x: 10,
      y: 20,
    });
    assert.deepEqual(calls[0].args, [
      "/tmp/a.png",
      "-crop",
      "100x50+10+20",
      "+repage",
      "/tmp/b.png",
    ]);
    assert.deepEqual(r, {
      input: "/tmp/a.png",
      output: "/tmp/b.png",
      width: 100,
      height: 50,
      x: 10,
      y: 20,
    });
  });

  it("crop validates dimensions and offsets before executing", async () => {
    const { exec, calls } = makeFake();
    await assert.rejects(
      () =>
        cropImage(exec, { input: "/tmp/a.png", output: "/tmp/b.png", width: 0, height: 50, x: 0, y: 0 }),
      /must be > 0/,
    );
    await assert.rejects(
      () =>
        cropImage(exec, { input: "/tmp/a.png", output: "/tmp/b.png", width: 10, height: 50, x: -1, y: 0 }),
      /must be >= 0/,
    );
    assert.equal(calls.length, 0);
  });

  it("rotate builds the -rotate argument from the angle", async () => {
    const { exec, calls } = makeFake();
    const r = await rotateImage(exec, {
      input: "/tmp/a.png",
      output: "/tmp/b.png",
      angle: 90,
    });
    assert.deepEqual(calls[0].args, ["/tmp/a.png", "-rotate", "90", "/tmp/b.png"]);
    assert.equal(calls[0].command, "convert");
    assert.deepEqual(r, { input: "/tmp/a.png", output: "/tmp/b.png", angle: 90 });
  });

  it("executor rejection surfaces as the tool error", async () => {
    const failing: ExecutorFn = async () => {
      throw new Error("image executor failed: spawn convert ENOENT");
    };
    await assert.rejects(
      () => rotateImage(failing, { input: "/tmp/a.png", output: "/tmp/b.png", angle: 45 }),
      /image executor failed: spawn convert ENOENT/,
    );
    await assert.rejects(
      () => getImageMetadata(failing, { input: "/tmp/a.png" }),
      /ENOENT/,
    );
  });
});
