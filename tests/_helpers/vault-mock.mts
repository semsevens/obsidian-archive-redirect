// In-memory mock of Obsidian's Vault / App surface — just enough for migrate.ts.
// All paths are vault-relative POSIX-style strings.
//
// File-like and Folder-like shapes follow Obsidian's TFile / TFolder duck-type:
//   files   have `stat` and NO `children`
//   folders have `children` and NO `stat`

export interface MockFile {
	path: string;
	name: string;
	parent: MockFolder | null;
	stat: { size: number; ctime: number; mtime: number };
	_content: ArrayBuffer | string; // ArrayBuffer for binary, string for text
}
export interface MockFolder {
	path: string;
	name: string;
	parent: MockFolder | null;
	children: Array<MockFile | MockFolder>;
}

function baseName(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? path : path.substring(i + 1);
}
function parentPath(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "" : path.substring(0, i);
}

export class MockVault {
	private files = new Map<string, MockFile>();
	private folders = new Map<string, MockFolder>();
	private trashed: string[] = [];
	private root: MockFolder;

	constructor() {
		this.root = { path: "", name: "", parent: null, children: [] };
		this.folders.set("", this.root);
	}

	// -- Test helpers --------------------------------------------------------

	seedFile(path: string, content: ArrayBuffer | string = ""): MockFile {
		this.ensureFolderChainSync(parentPath(path));
		const size = typeof content === "string" ? content.length : content.byteLength;
		const file: MockFile = {
			path,
			name: baseName(path),
			parent: this.folders.get(parentPath(path))!,
			stat: { size, ctime: 0, mtime: 0 },
			_content: content,
		};
		this.files.set(path, file);
		file.parent!.children.push(file);
		return file;
	}

	seedFolder(path: string): MockFolder {
		return this.ensureFolderChainSync(path);
	}

	private ensureFolderChainSync(dir: string): MockFolder {
		if (this.folders.has(dir)) return this.folders.get(dir)!;
		const parent = this.ensureFolderChainSync(parentPath(dir));
		const folder: MockFolder = {
			path: dir,
			name: baseName(dir),
			parent,
			children: [],
		};
		this.folders.set(dir, folder);
		parent.children.push(folder);
		return folder;
	}

	allFilePaths(): string[] {
		return [...this.files.keys()].sort();
	}

	allFolderPaths(): string[] {
		return [...this.folders.keys()].filter((p) => p !== "").sort();
	}

	wasTrashed(path: string): boolean {
		return this.trashed.includes(path);
	}

	readText(path: string): string {
		const f = this.files.get(path);
		if (!f) throw new Error(`not found: ${path}`);
		if (typeof f._content === "string") return f._content;
		return new TextDecoder().decode(f._content);
	}

	// -- Vault.adapter mock ---------------------------------------------------

	adapter = {
		exists: async (p: string) => this.files.has(p) || this.folders.has(p),
		mkdir: async (p: string) => {
			if (!this.folders.has(parentPath(p)) && parentPath(p) !== "") {
				throw new Error(`parent missing for mkdir ${p}`);
			}
			if (this.folders.has(p)) return;
			const parent = this.folders.get(parentPath(p))!;
			const folder: MockFolder = {
				path: p,
				name: baseName(p),
				parent,
				children: [],
			};
			this.folders.set(p, folder);
			parent.children.push(folder);
		},
		write: async (p: string, content: string) => {
			if (this.files.has(p)) {
				const f = this.files.get(p)!;
				f._content = content;
				f.stat.size = content.length;
				return;
			}
			this.seedFile(p, content);
		},
		writeBinary: async (p: string, buf: ArrayBuffer) => {
			if (this.files.has(p)) {
				const f = this.files.get(p)!;
				f._content = buf;
				f.stat.size = buf.byteLength;
				return;
			}
			this.seedFile(p, buf);
		},
		read: async (p: string) => {
			const f = this.files.get(p);
			if (!f) throw new Error(`not found: ${p}`);
			if (typeof f._content === "string") return f._content;
			return new TextDecoder().decode(f._content);
		},
		append: async (p: string, content: string) => {
			const f = this.files.get(p);
			if (!f) {
				this.seedFile(p, content);
				return;
			}
			const existing = typeof f._content === "string" ? f._content : new TextDecoder().decode(f._content);
			f._content = existing + content;
			f.stat.size = (f._content as string).length;
		},
	};

	// -- Vault methods --------------------------------------------------------

	getRoot(): MockFolder {
		return this.root;
	}

	getAbstractFileByPath(p: string): MockFile | MockFolder | null {
		return this.files.get(p) ?? this.folders.get(p) ?? null;
	}

	async readBinary(file: MockFile): Promise<ArrayBuffer> {
		if (typeof file._content === "string") {
			return new TextEncoder().encode(file._content).buffer as ArrayBuffer;
		}
		return file._content;
	}

	// -- App.fileManager mock -------------------------------------------------

	fileManager = {
		renameFile: async (file: MockFile | MockFolder, newPath: string) => {
			if (this.files.has(file.path)) {
				const f = this.files.get(file.path)!;
				this.files.delete(file.path);
				f.parent!.children = f.parent!.children.filter((c) => c !== f);
				f.path = newPath;
				f.name = baseName(newPath);
				this.ensureFolderChainSync(parentPath(newPath));
				f.parent = this.folders.get(parentPath(newPath))!;
				f.parent.children.push(f);
				this.files.set(newPath, f);
			} else if (this.folders.has(file.path)) {
				throw new Error(`folder rename not supported in mock: ${file.path}`);
			}
		},
		trashFile: async (file: MockFile | MockFolder) => {
			this.trashed.push(file.path);
			if (this.files.has(file.path)) {
				const f = this.files.get(file.path)!;
				this.files.delete(file.path);
				f.parent!.children = f.parent!.children.filter((c) => c !== f);
			} else if (this.folders.has(file.path)) {
				const f = this.folders.get(file.path)!;
				this.folders.delete(file.path);
				if (f.parent) f.parent.children = f.parent.children.filter((c) => c !== f);
			}
		},
	};
}

/**
 * Build a thing that satisfies `App` enough for migrate.ts. Cast to `any` at
 * the call site; the real Obsidian App has dozens of fields we don't need.
 */
export function mockApp(vault: MockVault) {
	return {
		vault,
		fileManager: vault.fileManager,
	};
}
