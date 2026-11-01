# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `imageport metadata|resize|convert|crop|rotate` and
  `imageport mcp`; resize takes `--width` / `--height` flags.
- MCP server (`imageport mcp`, stdio) with five tools:
  `get_image_metadata`, `resize_image`, `convert_image`,
  `crop_image`, and `rotate_image`.
- All work is local ImageMagick processing — metadata via
  `identify`, the rest via `convert` — behind an injectable
  executor that spawns the binaries with `execFile` argument
  arrays (no shell). No API key, no hosted AI generation, and no
  fabricated results: when ImageMagick is absent the spawn error
  surfaces as the tool error.
- `convert_image` accepts png, jpg, webp, gif, avif, bmp, and
  tiff, and replaces the output extension with the target format
  when the two differ, returning the effective output path.
- The test suite runs entirely on a fake executor that asserts the
  exact command and argument construction — no ImageMagick needed.
