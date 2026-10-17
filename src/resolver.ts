import { createHash } from "crypto";
import type { ArchiveSettings, SourceOrder } from "./settings";

/**
 * Map (remote URL, owning markdown path, settings) → vault-relative archive path.
 *
 * Pure function — same inputs always yield the same output. The two modes:
 *
 *  - "sibling": archive lives next to the markdown that referenced it.
 *      <mdDir>/<archiveDirName>/<sha1>.<ext>
 *      Pros: notes are self-contained, easy to move/share.
 *      Cons: same URL across notes is stored once per folder (no global dedup).
 *
 *  - "central": one shared folder at the vault root, bucketed by hash prefix.
 *      <centralArchivePath>/<bucket>/<sha1>.<ext>
 *      Pros: true global dedup; cache survives moving the markdown.
 *      Cons: deleting a note leaves orphan cache (needs GC).
 *
 * mdPath is kept in the signature even for "central" so a future "mixed mode"
 * (per-folder policy) can be added without changing every call site.
 */
export function resolve(url: string, mdPath: string, settings: ArchiveSettings): string {
	if (settings.archiveMode === "central") {
		return `${settings.centralArchivePath}/${bucketedName(url)}`;
	}

	const dir = mdPath.substring(0, mdPath.lastIndexOf("/"));
	return `${dir}/${settings.archiveDirName}/${bucketedName(url).substring(3)}`;
}

/** Where the server copy of `url` lives: the central layout, under `serverUrl`. */
export function serverUrlFor(url: string, serverUrl: string): string | null {
	const base = serverUrl.trim().replace(/\/+$/, "");
	return base ? `${base}/${bucketedName(url)}` : null;
}

/** The archived copies to try, in the order the settings ask for; missing ones left out. */
export function orderSources(
	copies: { local: string | null; server: string | null },
	order: SourceOrder,
): string[] {
	const list = order === "server-first" ? [copies.server, copies.local] : [copies.local, copies.server];
	return list.filter((s): s is string => !!s);
}

/** <bucket>/<sha1>.<ext>, the bucket being the first two hex chars of the hash. */
function bucketedName(url: string): string {
	const hash = createHash("sha1").update(url).digest("hex");
	return `${hash.substring(0, 2)}/${hash}.${guessExt(url)}`;
}

function guessExt(url: string): string {
	try {
		const u = new URL(url);
		const pathMatch = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
		if (pathMatch) return pathMatch[1].toLowerCase();
		const fmt = u.searchParams.get("wx_fmt");
		if (fmt) return fmt.toLowerCase();
	} catch {
		// fallthrough
	}
	return "bin";
}
