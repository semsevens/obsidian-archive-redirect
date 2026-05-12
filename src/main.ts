import { MarkdownPostProcessorContext, Notice, Plugin, TFile } from "obsidian";
import { resolve } from "./resolver";
import { extractUrls } from "./scanner";
import { download, DownloadResult } from "./downloader";
import { ArchiveSettings, ArchiveSettingTab, DEFAULT_SETTINGS, isInScope } from "./settings";

export default class ArchiveRedirectPlugin extends Plugin {
	settings!: ArchiveSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor((el, ctx) => this.interceptImg(el, ctx));

		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!this.settings.autoArchiveOnModify) return;
				if (!(file instanceof TFile) || file.extension !== "md") return;
				if (!isInScope(file.path, this.settings.includedPaths)) return;
				await this.archiveMd(file);
			}),
		);

		this.addCommand({
			id: "archive-scan-vault",
			name: "Scan vault & archive remote resources",
			callback: () => this.scanAll(),
		});

		this.addSettingTab(new ArchiveSettingTab(this.app, this));
	}

	private interceptImg(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		el.querySelectorAll("img").forEach((img) => {
			const src = img.getAttribute("src");
			if (!src || !src.startsWith("http")) return;
			const localPath = resolve(src, ctx.sourcePath, this.settings.archiveDirName);
			const file = this.app.vault.getAbstractFileByPath(localPath);
			if (file instanceof TFile) {
				img.setAttribute("src", this.app.vault.getResourcePath(file));
			}
		});
	}

	private async archiveMd(file: TFile): Promise<{ ok: number; failed: number }> {
		const content = await this.app.vault.read(file);
		const urls = extractUrls(content);
		let ok = 0;
		let failed = 0;
		for (const url of urls) {
			const dest = resolve(url, file.path, this.settings.archiveDirName);
			try {
				const r: DownloadResult = await download(url, dest, this.app.vault);
				if (r === "downloaded") ok++;
			} catch (e: unknown) {
				failed++;
				const msg = e instanceof Error ? e.message : String(e);
				console.warn(`[archive-redirect] ${file.path} ← ${url}: ${msg}`);
			}
		}
		return { ok, failed };
	}

	private async scanAll() {
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => isInScope(f.path, this.settings.includedPaths));
		const scopeNote = this.settings.includedPaths.length
			? ` (scope: ${this.settings.includedPaths.join(", ")})`
			: "";
		new Notice(`Archive scan: ${files.length} files${scopeNote}…`);
		let totalOk = 0;
		let totalFailed = 0;
		let processed = 0;
		for (const f of files) {
			const { ok, failed } = await this.archiveMd(f);
			totalOk += ok;
			totalFailed += failed;
			processed++;
			if (processed % 25 === 0) {
				console.log(`[archive-redirect] ${processed}/${files.length}  (+${totalOk} ok, ${totalFailed} failed)`);
			}
		}
		new Notice(`Archive scan done: ${totalOk} downloaded, ${totalFailed} failed.`);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
