import { promises as fs } from "fs";
import { homedir } from "os";
import type { DataAdapter, Vault } from "obsidian";
import { expandHome, isExternalPath } from "./settings.ts";

/**
 * The few file operations the archive needs. The vault adapter provides them
 * for an archive inside the vault; `fsStore` for one outside it, which the
 * vault API cannot reach.
 */
export type Store = Pick<DataAdapter, "exists" | "mkdir" | "write" | "writeBinary" | "append">;

/** The store that holds `path`, and the path as that store expects it. */
export function storeFor(vault: Vault, path: string): { store: Store; path: string } {
	if (!isExternalPath(path)) return { store: vault.adapter, path };
	return { store: fsStore, path: expandHome(path, homedir()) };
}

const fsStore: Store = {
	exists: (p) => fs.access(p).then(() => true, () => false),
	mkdir: (p) => fs.mkdir(p),
	write: (p, data) => fs.writeFile(p, data),
	writeBinary: (p, data) => fs.writeFile(p, Buffer.from(data)),
	append: (p, data) => fs.appendFile(p, data),
};
