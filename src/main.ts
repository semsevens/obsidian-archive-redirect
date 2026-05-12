import { MarkdownPostProcessorContext, Notice, Plugin, TFile } from "obsidian";
import { resolve } from "./resolver";
import { extractUrls } from "./scanner";
import { download, DownloadResult } from "./downloader";
import { ArchiveSettings, ArchiveSettingTab, DEFAULT_SETTINGS, isInScope } from "./settings";
import { redirectAllMedia } from "./intercept";
import { createLivePreviewExtension } from "./live-preview";

export default class ArchiveRedirectPlugin extends Plugin {
	settings!: ArchiveSettings;

	async onload() {
		await this.loadSettings();

		// Reading mode
		this.registerMarkdownPostProcessor((el, ctx) => this.interceptMedia(el, ctx));

		// Live Preview / Source mode (CM6)
		this.registerEditorExtension(createLivePreviewExtension(this));

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

	private interceptMedia(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		redirectAllMedia(el, ctx.sourcePath, this.settings.archiveDirName, this.app);
	}

	private async archiveMd(file: TFile): Promise<{ ok: number; transient: number; permanent: number }> {
		const content = await this.app.vault.read(file);
		const urls = extractUrls(content);
		let ok = 0;
		let transient = 0;
		let permanent = 0;
		for (const url of urls) {
			const dest = resolve(url, file.path, this.settings.archiveDirName);
			try {
				const r: DownloadResult = await download(url, dest, this.app.vault);
				if (r === "downloaded") ok++;
				else if (r === "failed-transient") transient++;
				else if (r === "failed-permanent") permanent++;
			} catch (e: unknown) {
				transient++;
				const msg = e instanceof Error ? e.message : String(e);
				console.warn(`[archive-redirect] ${file.path} ← ${url}: ${msg}`);
			}
		}
		return { ok, transient, permanent };
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
		let totalTransient = 0;
		let totalPermanent = 0;
		let processed = 0;
		for (const f of files) {
			const { ok, transient, permanent } = await this.archiveMd(f);
			totalOk += ok;
			totalTransient += transient;
			totalPermanent += permanent;
			processed++;
			if (processed % 25 === 0) {
				console.log(
					`[archive-redirect] ${processed}/${files.length}  (+${totalOk} ok, ${totalTransient} transient, ${totalPermanent} permanent)`,
				);
			}
		}
		new Notice(
			`Archive scan done: ${totalOk} downloaded, ${totalTransient} transient fails, ${totalPermanent} permanent fails.`,
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
