# imageport — Build Report

MCP Rebuild 100. Clean-room rebuild of the image-tools target,
built from the program-defined fill-in spec captured in
`harness/fixtures/image-tools-tools-original.json` only. The
fixture was created for this build and is labelled a fill-in spec:
image-tools is a TARGETS.json fill-in with `source_repo: null` —
no original server exists to probe — so parity proves the rebuild
matches this program's defined spec (the common public image-tools
MCP pattern: metadata, resize, convert, crop, rotate, executed
through ImageMagick). Per program ruling for fill-ins there is NO
hosted AI generation and NO fake AI result anywhere in this build:
it is a local image-processing server only, and no image
generation/AI tools are included. Local build only — nothing
pushed or published.

Identity: repo `imageport`, npm `@reneturcios/imageport`,
MCP name `io.github.CloudCorpRecords/imageport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `imageport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Local image tools via ImageMagick:
  metadata, resize, convert, crop, rotate." = **75 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/imageport:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/imageport"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`metadata`, `resize`, `convert`,
  `crop`, `rotate`, `mcp`, `--version`; exit 2 usage / 1
  ImageMagick error), `src/mcp.ts`, `src/types.ts`,
  `src/imageport.ts` (core logic, `VERSION = "0.1.0"`)
- `test/imageport.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to imageport)

## Tools implemented (5)

`get_image_metadata`, `resize_image`, `convert_image`,
`crop_image`, `rotate_image` — the full defined fill-in set, as
recorded in the fixture `_source`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the defined
  spec and break exact schema parity. Zod still validates every
  `tools/call` (numbers via `z.number()`).
- All work runs through an injectable `ExecutorFn`
  (`(command, args) => Promise<{stdout, stderr}>`); core functions
  take `(exec, options)`. No API key is needed or read.
- `get_image_metadata` runs
  `identify -format "%m|%w|%h|%[colorspace]|%b" <input>` and parses
  the pipe-delimited line into
  `{input, format, width: Number, height: Number, colorSpace, fileSize}`;
  output that does not parse is an error, never a partial guess.
- `resize_image` requires at least one of width / height
  (validated in core, before any execution) and builds the
  geometry as `WxH`, `Wx` or `xH`; it returns
  `{input, output, width: width ?? null, height: height ?? null}`.
- `convert_image` lowercases and validates the format against the
  documented set (png, jpg, webp, gif, avif, bmp, tiff); anything
  else is an error listing the allowed formats. Because ImageMagick
  picks the output format from the extension, the output path's
  extension is replaced with the target format whenever the two
  differ (an extensionless output gains it), and the returned
  `output` is that effective path — documented in the README and
  the core comment.
- `crop_image` validates width/height > 0 and x/y >= 0, then runs
  `convert <input> -crop WxH+X+Y +repage <output>`.
- `rotate_image` runs `convert <input> -rotate <angle> <output>`.
- The default executor (`createDefaultExecutor`) spawns the real
  binaries via `node:child_process` `execFile` with argument
  arrays — no shell — and wraps failures as
  `image executor failed: <message>`, so a missing ImageMagick
  surfaces its own ENOENT honestly.

## Verification (foreground, exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js`. (`node_modules` was
copied from modelrun's tree and its `.bin` entries re-chmodded
`+x`, the standing copy fix.)

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 13
ℹ pass 13
ℹ fail 0
```
Fake executor only — no ImageMagick needed. Covers: metadata
parse from canned identify stdout (`PNG|800|600|sRGB|12.3KB`)
asserting every field plus the exact identify argument array;
unparseable identify output rejected; resize both-dimensions
(`400x300`), width-only (`200x`, null height) and height-only
(`x150`, null width) geometries; resize with neither dimension
errors with the executor never called; convert format-validation
error lists the allowed formats with the executor never called;
convert extension replacement (`photo.png` + format `webp` →
`photo.webp` argument and result) and the already-matching case
(including case-insensitive `JPG`); crop arguments including
`+repage`, plus crop validation with no execution; rotate
arguments; executor rejection surfaces the wrapped
`image executor failed: spawn convert ENOENT` error.

### 3. CLI / MCP smoke
`--version` → `0.1.0`; unknown command exits 2 with Usage. MCP
`initialize` over stdio → `serverInfo: {"name":"imageport",
"version":"0.1.0"}`. A real `tools/call` for `get_image_metadata`
and a real CLI `metadata` run were both attempted in this VM:
ImageMagick is **absent** here (`which convert identify` finds
neither binary), so both returned the honest error —
MCP: `isError: true` with text "image executor failed: spawn
identify ENOENT"; CLI: exit 1 with the same message on stderr.
No live ImageMagick happy-path run is claimed.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/image-tools-tools-original.json \
    --rebuild "stdio:node .../builds/imageport/dist/cli.js mcp" \
    --out .../builds/imageport/parity-out
verdict=PASS parity_pct=100.0 original_tools=5 rebuild_tools=5 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 5/5.) Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was copied from modelrun's and its identity
fields edited (top-level `name`, root package `name`, root package
`bin` key → imageport; dependency ranges are identical, so the
tree is unchanged). **Clean lockfile regen required before
publish** (regenerate with no `node_modules` present); do not
publish from this lockfile as-is. `node_modules` here is a copy of
modelrun's; `.bin/tsc` / `.bin/tsx` verified working after the
chmod fix above.

## Gaps / honest notes

- Fill-in spec: image-tools has `source_repo: null`; there is no
  original server to probe. Parity proves the rebuild matches this
  program's defined 5-tool spec, labelled fill-in in the fixture —
  nothing more is claimed.
- No live ImageMagick run was performed: neither `convert` nor
  `identify` exists in this VM (checked firsthand). Happy paths
  are argument-construction + fake-executor tests only; the
  default executor's real behaviour proven here is the honest
  ENOENT path, over both MCP and CLI.
- Container gap (same class as earlier shell-out gaps — repoport
  gap 10, videokit gap 25): the node:20-alpine runtime image
  bundles no ImageMagick, so containerised imageport passes
  initialize/usage smoke only; real work needs a host install of
  ImageMagick (or a publish-wave image change adding it).
- `get_image_metadata`'s `fileSize` is ImageMagick's own `%b`
  human-readable string (for example `12.3KB`), returned as-is —
  never converted or invented.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
