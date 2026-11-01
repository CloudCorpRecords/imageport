# imageport

imageport does local image work with ImageMagick. It reads an image
file's metadata — format, dimensions, color space, file size —
resizes an image while preserving its aspect ratio, converts
between the common web and print formats (png, jpg, webp, gif,
avif, bmp, tiff), crops a rectangle out of an image, and rotates by
an angle in degrees. Every operation is plain local file
processing: there is no image generation, no hosted AI, and no
network call anywhere in this package.

All five tools build ImageMagick argument arrays and run them
through one injectable executor. The default executor spawns
`convert` and `identify` with `node:child_process` `execFile` —
argument arrays, never a shell string — so a host needs ImageMagick
installed. When the binaries are absent, the spawn error (for
example ENOENT) is surfaced as the tool error, honestly; nothing is
faked. The unit tests exercise the same core through a fake
executor that records the argument arrays, so they need no
ImageMagick at all.

One behaviour worth knowing up front: ImageMagick decides the
output format from the output file's extension, so `convert_image`
replaces the requested output path's extension with the target
format whenever the two differ (converting `photo.png` to webp
writes `photo.webp`), and the result reports that effective path.

## Install

```bash
npx -y @reneturcios/imageport mcp
```

Or run the container image (note: the container bundles no
ImageMagick, so it passes MCP initialize / CLI usage smoke only —
run on a host with ImageMagick installed for real work):

```bash
docker run -i ghcr.io/cloudcorprecords/imageport
```

## CLI

```bash
imageport metadata <input>
imageport resize <input> <output> [--width n] [--height n]
imageport convert <input> <output> <format>
imageport crop <input> <output> <width> <height> <x> <y>
imageport rotate <input> <output> <angle>
imageport mcp
imageport --version
```

Examples:

```bash
imageport metadata photo.png
imageport resize photo.png photo-small.png --width 800
imageport convert photo.png photo-out.png webp   # writes photo-out.webp
imageport crop photo.png tile.png 200 200 40 60
imageport rotate photo.png photo-upright.png 90
```

Each command prints its result as JSON. Exit codes: `0` on success,
`1` when ImageMagick fails (including when it is not installed),
`2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/imageport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "imageport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/imageport", "mcp"]
    }
  }
}
```

### Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `get_image_metadata` | `input` (required) | Reads format, width, height, color space, and file size via `identify`. |
| `resize_image` | `input`, `output` (required); `width`, `height` (at least one) | Resizes preserving aspect ratio via `convert -resize`. |
| `convert_image` | `input`, `output`, `format` (required) | Converts to png, jpg, webp, gif, avif, bmp, or tiff; the output extension is replaced with the format when it differs. |
| `crop_image` | `input`, `output`, `width`, `height`, `x`, `y` (required) | Crops a `width` x `height` region at offset `x`, `y` via `convert -crop ... +repage`. |
| `rotate_image` | `input`, `output`, `angle` (required) | Rotates by `angle` degrees via `convert -rotate`. |

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, fake executor, no ImageMagick needed
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
