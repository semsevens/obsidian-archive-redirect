import { createHash } from "crypto";
import type { ArchiveSettings } from "./settings";

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
	const hash = createHash("sha1").update(url).digest("hex");
	const ext = guessExt(url);

	if (settings.archiveMode === "central") {
		const bucket = hash.substring(0, 2);
		return `${settings.centralArchivePath}/${bucket}/${hash}.${ext}`;
	}

	const dir = mdPath.substring(0, mdPath.lastIndexOf("/"));
	return `${dir}/${settings.archiveDirName}/${hash}.${ext}`;
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
