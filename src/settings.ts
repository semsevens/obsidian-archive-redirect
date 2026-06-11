// Pure data + helpers. Kept free of `obsidian` runtime imports so tests can
// load this module without spinning up Obsidian's class registry.
// UI lives in `settings-ui.ts`.

export type ArchiveMode = "sibling" | "central";

export interface ArchiveSettings {
	archiveMode: ArchiveMode;
	archiveDirName: string;
	centralArchivePath: string;
	autoArchiveOnModify: boolean;
	includedPaths: string[];
}

export const DEFAULT_SETTINGS: ArchiveSettings = {
	archiveMode: "sibling",
	archiveDirName: "_archive",
	centralArchivePath: "_archive",
	autoArchiveOnModify: true,
	includedPaths: [],
};

export function isInScope(mdPath: string, includedPaths: string[]): boolean {
	if (includedPaths.length === 0) return true;
	return includedPaths.some((p) => mdPath === p || mdPath.startsWith(p + "/"));
}
