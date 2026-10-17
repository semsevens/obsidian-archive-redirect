// Pure data + helpers. Kept free of `obsidian` runtime imports so tests can
// load this module without spinning up Obsidian's class registry.
// UI lives in `settings-ui.ts`.

export type ArchiveMode = "sibling" | "central";

/** Which copy to show first. The remote URL is always the last resort. */
export type SourceOrder = "server-first" | "local-first";

export interface ArchiveSettings {
	archiveMode: ArchiveMode;
	archiveDirName: string;
	centralArchivePath: string;
	autoArchiveOnModify: boolean;
	includedPaths: string[];
	/** Base URL of a server copy laid out as <bucket>/<sha1>.<ext>; empty = none. */
	serverUrl: string;
	sourceOrder: SourceOrder;
}

export const DEFAULT_SETTINGS: ArchiveSettings = {
	archiveMode: "sibling",
	archiveDirName: "_archive",
	centralArchivePath: "_archive",
	autoArchiveOnModify: true,
	includedPaths: [],
	serverUrl: "",
	sourceOrder: "server-first",
};

/** An archive path given as absolute (or ~/) lives outside the vault. */
export function isExternalPath(path: string): boolean {
	return path.startsWith("/") || path.startsWith("~/");
}

export function expandHome(path: string, home: string): string {
	return path.startsWith("~/") ? home + path.substring(1) : path;
}

export function isInScope(mdPath: string, includedPaths: string[]): boolean {
	if (includedPaths.length === 0) return true;
	return includedPaths.some((p) => mdPath === p || mdPath.startsWith(p + "/"));
}
