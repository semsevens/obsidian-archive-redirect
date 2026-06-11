# Archive Redirect

Archive remote URLs referenced in your markdown to a local cache, and transparently serve the cache when the note is rendered. Defends your vault against link rot without rewriting any markdown.

## The problem

Notes that quote articles, tweets, or research often embed remote images, video, or audio:

```markdown
![](https://mmbiz.qpic.cn/.../abc.jpg)
![](https://pbs.twimg.com/media/XYZ.png?name=orig)
```

When the original host disappears (the WeChat account is deleted, the tweet is removed, the CDN expires the URL), every embed in your vault silently breaks. The note still reads, but the visual context is gone.

## What this plugin does

For every remote `<img>`, `<video>`, `<audio>` it encounters:

1. **Archives** the file under a content-addressed path (SHA1 of the URL). Two storage modes are supported:
   - **Sibling** (default): `<mdDir>/_archive/<sha1>.<ext>` — one folder per markdown's directory, notes stay self-contained.
   - **Central**: `<centralPath>/<bucket>/<sha1>.<ext>` — a single shared folder at a vault-relative path, bucketed by the first 2 hex chars of the SHA1 (256 buckets). True global dedup; cache survives moving the markdown.
2. **Redirects** the rendered element's `src` to the local archive at display time — in both Reading mode and Live Preview.
3. **Leaves the markdown file untouched.** The URL in your `.md` never changes. If you later view the file outside Obsidian, share it, or this plugin is uninstalled, the remote URL still works as a fallback.

The archive is content-addressed by URL hash, so the same URL appearing in multiple notes is stored once (sibling mode dedups per folder; central mode dedups across the whole vault).

## How it works

```
┌──────────────────────────┐
│  ![](https://remote.url) │   ← markdown stays as-is
└──────────┬───────────────┘
           │
           ▼
   ┌──────────────────────────────────────┐
   │  Scanner extracts URLs               │
   │  Policy decides which to archive     │   ← domain rules + media extension
   │  Downloader fetches with retry       │
   │  File saved at _archive/<sha1>.<ext> │
   └──────────────────────────────────────┘
           │
           ▼
   ┌──────────────────────────────────────┐
   │  At render time:                     │
   │  resolve(url) → vault path → swap    │   ← Reading + Live Preview
   │  if local present, else leave remote │
   └──────────────────────────────────────┘
```

## Triggers

The plugin archives in three ways:

- **On file modify**: when you edit a markdown file, new remote URLs in it are queued for download.
- **Manual scan**: command `Scan vault & archive remote resources` walks every markdown file in scope.
- **No render-time downloads.** Display only swaps to local if the archive already exists.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| Archive mode | `Sibling` | `Sibling` = per-note folder; `Central` = one shared vault-relative folder with hash bucketing. |
| Archive directory name *(sibling)* | `_archive` | Subfolder name (sibling to each `.md`) that holds cached files. |
| Central archive path *(central)* | `_archive` | Vault-relative folder that holds all cached files, bucketed by hash prefix. |
| Auto-archive on file modify | on | If off, only the manual scan command triggers downloads. |
| Included paths | (empty = whole vault) | Newline-separated vault paths to operate on. Example: `raw/wechat`. |

## Domain policies

Built-in rules in `policies.ts`:

| Domain | Action | Notes |
|---|---|---|
| `mmbiz.qpic.cn`, `res.wx.qq.com`, `mmbiz.qlogo.cn` | archive | WeChat — requires `Referer: https://mp.weixin.qq.com/` |
| `pbs.twimg.com` | archive | Twitter / X images |
| `video.twimg.com` | **skip** | Twitter videos are large and the CDN is long-term stable |
| `youtube.com`, `youtu.be`, `vimeo.com` | skip | stream-only |
| (anything else) | archive only if URL has a media extension (`.jpg`/`.png`/`.mp4`/…) | prevents accidentally fetching HTML page URLs |

## Failure handling

- 3 attempts with `[0, 1s, 3s]` backoff.
- 15 second timeout per request.
- `http://` URLs are automatically upgraded to `https://` (Obsidian's `requestUrl` does not accept cleartext HTTP).
- Permanent statuses (400 / 401 / 403 / 404 / 410 / 451) skip retry.
- Failed downloads append a JSONL entry to `<archive>/.failed.jsonl` with URL, error, and timestamp.

## Installation

### Via BRAT (current)

While awaiting Community Plugins approval:

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. Command palette → `BRAT: Add a beta plugin for testing`.
3. Enter `semsevens/obsidian-archive-redirect`.
4. Enable Archive Redirect in Community plugins.

### Manual

Download `main.js` and `manifest.json` from the [latest release](https://github.com/semsevens/obsidian-archive-redirect/releases) into `<vault>/.obsidian/plugins/archive-redirect/`, then enable.

## ⚠️ Do NOT combine with attachment-cleanup plugins

Archive Redirect **never modifies your markdown**. The URL in your `.md` stays
remote; the local cache is swapped in only at render time, via the rendered
`<img>` / `<video>` / `<audio>` element's `src` attribute.

This means **third-party "remove orphaned attachments" plugins cannot see that
the local cache is in use** — they scan for markdown `![]()` or `[[wikilink]]`
references, not HTML `src` attributes. They will flag every file in `_archive/`
as orphaned and may delete the entire folder, **including content whose source
URLs are already dead and unrecoverable.**

Known dangerous combinations (verified via GitHub issues — 450-image vault wipes
have happened in the wild):

- **`oz-clear-unused-images`** — repeated reports of mass deletion of HTML-referenced images.
- **`Local Images Plus`** "Remove orphaned attachments" / "(Plugin folder)" commands.
- Any "garbage-collect unused attachments" tool.

Mitigations Archive Redirect ships with:

- A marker file `.archive-redirect-managed` is written into every archive folder
  with a warning. Some cleanup plugins respect such markers; most do not.
- This warning, prominently in the README.

**Your responsibility**: either uninstall the cleanup tool while Archive
Redirect is active, or configure it to exclude your archive folder.

## Limitations

- **Desktop only.** Uses Node's `crypto` module; mobile support requires swapping to Web Crypto (which is async) and is planned for a later release.
- **No Live Preview widget replacement.** The plugin mutates `src` after Obsidian renders the element. It does not interfere with other plugins (e.g. `auto-embed`) that work on page URLs.
- **Large files block the main thread.** The current downloader is synchronous from Obsidian's perspective. Acceptable for thousands of images; not yet tuned for large video archives.

## License

MIT
