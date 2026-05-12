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

1. **Archives** the file to `<dir>/_archive/<sha1-of-url>.<ext>` (a sibling folder next to the markdown that referenced it).
2. **Redirects** the rendered element's `src` to the local archive at display time — in both Reading mode and Live Preview.
3. **Leaves the markdown file untouched.** The URL in your `.md` never changes. If you later view the file outside Obsidian, share it, or this plugin is uninstalled, the remote URL still works as a fallback.

The archive is content-addressed by URL hash, so the same URL appearing in multiple notes is stored once.

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
| Archive directory name | `_archive` | Subfolder name (sibling to each `.md`) that holds cached files. |
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

## Limitations

- **Desktop only.** Uses Node's `crypto` module; mobile support requires swapping to Web Crypto (which is async) and is planned for a later release.
- **No Live Preview widget replacement.** The plugin mutates `src` after Obsidian renders the element. It does not interfere with other plugins (e.g. `auto-embed`) that work on page URLs.
- **Large files block the main thread.** The current downloader is synchronous from Obsidian's perspective. Acceptable for thousands of images; not yet tuned for large video archives.

## License

MIT
