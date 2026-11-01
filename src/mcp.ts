/**
 * imageport MCP server. Tools: get_image_metadata, resize_image,
 * convert_image, crop_image, rotate_image.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys that
 * are not in this toolset's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the spec's
 * exact input schemas as explicit literals, while zod still
 * validates every tools/call argument set.
 *
 * Calls run through the default executor, which shells out to the
 * host's ImageMagick `convert` / `identify` binaries via execFile
 * argument arrays. When ImageMagick is absent, the spawn error
 * (for example ENOENT) surfaces as an honest isError result.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  convertImage,
  createDefaultExecutor,
  cropImage,
  getImageMetadata,
  resizeImage,
  rotateImage,
  VERSION,
} from "./imageport.js";

const MetadataArgs = z.object({ input: z.string() });
const ResizeArgs = z.object({
  input: z.string(),
  output: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});
const ConvertArgs = z.object({ input: z.string(), output: z.string(), format: z.string() });
const CropArgs = z.object({
  input: z.string(),
  output: z.string(),
  width: z.number(),
  height: z.number(),
  x: z.number(),
  y: z.number(),
});
const RotateArgs = z.object({ input: z.string(), output: z.string(), angle: z.number() });

const TOOLS = [
  {
    name: "get_image_metadata",
    description: "Read metadata for an image file: format, width, height, color space, and file size.",
    inputSchema: {
      type: "object" as const,
      properties: { input: { type: "string", description: "Path to the image file to read metadata from." } },
      required: ["input"],
    },
  },
  {
    name: "resize_image",
    description: "Resize an image to the given width and/or height, preserving aspect ratio, and write it to the output path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        input: { type: "string", description: "Path to the source image file to resize." },
        output: { type: "string", description: "Path where the resized image will be written." },
        width: { type: "number", description: "Target width in pixels. Optional; at least one of width and height is required, and aspect ratio is preserved." },
        height: { type: "number", description: "Target height in pixels. Optional; at least one of width and height is required, and aspect ratio is preserved." },
      },
      required: ["input", "output"],
    },
  },
  {
    name: "convert_image",
    description: "Convert an image to another format (png, jpg, webp, gif, avif, bmp, tiff) and write it to the output path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        input: { type: "string", description: "Path to the source image file to convert." },
        output: { type: "string", description: "Path where the converted image will be written. Its extension is replaced by the target format when they differ." },
        format: { type: "string", description: "Target image format: one of png, jpg, webp, gif, avif, bmp, or tiff." },
      },
      required: ["input", "output", "format"],
    },
  },
  {
    name: "crop_image",
    description: "Crop a width x height region starting at offset x, y and write it to the output path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        input: { type: "string", description: "Path to the source image file to crop." },
        output: { type: "string", description: "Path where the cropped image will be written." },
        width: { type: "number", description: "Width in pixels of the crop region. Must be greater than 0." },
        height: { type: "number", description: "Height in pixels of the crop region. Must be greater than 0." },
        x: { type: "number", description: "Horizontal offset in pixels of the crop region's starting corner. Must be 0 or greater." },
        y: { type: "number", description: "Vertical offset in pixels of the crop region's starting corner. Must be 0 or greater." },
      },
      required: ["input", "output", "width", "height", "x", "y"],
    },
  },
  {
    name: "rotate_image",
    description: "Rotate an image by the given angle in degrees and write it to the output path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        input: { type: "string", description: "Path to the source image file to rotate." },
        output: { type: "string", description: "Path where the rotated image will be written." },
        angle: { type: "number", description: "Rotation angle in degrees." },
      },
      required: ["input", "output", "angle"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "imageport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const exec = createDefaultExecutor();
  try {
    let out: unknown;
    if (name === "get_image_metadata") {
      out = await getImageMetadata(exec, MetadataArgs.parse(args ?? {}));
    } else if (name === "resize_image") {
      out = await resizeImage(exec, ResizeArgs.parse(args ?? {}));
    } else if (name === "convert_image") {
      out = await convertImage(exec, ConvertArgs.parse(args ?? {}));
    } else if (name === "crop_image") {
      out = await cropImage(exec, CropArgs.parse(args ?? {}));
    } else if (name === "rotate_image") {
      out = await rotateImage(exec, RotateArgs.parse(args ?? {}));
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(out);
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
