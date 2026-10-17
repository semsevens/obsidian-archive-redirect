import { MarkdownPostProcessorContext, Notice, Plugin, TFile } from "obsidian";
import { resolve } from "./resolver";
import { extractUrls } from "./scanner";
import { download, DownloadResult } from "./downloader";
import { ArchiveSettings, DEFAULT_SETTINGS, isExternalPath, isInScope } from "./settings";
import { ArchiveSettingTab } from "./settings-ui";
import { redirectAllMedia } from "./intercept";
import { createLivePreviewExtension } from "./live-preview";
import { MigrateModal } from "./migrate-modal";
import { findStaleCentralArchives, reconcile } from "./reconcile.ts";
import { ServerProbe } from "./server-probe";

export default class ArchiveRedirectPlugin extends Plugin {
	settings!: ArchiveSettings;
	readonly server = new ServerProbe();

	async onload() {
		await this.loadSettings();
		// Ask the server now, so the first note rendered doesn't wait for the answer.
		void this.server.reachable(this.settings.serverUrl);

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

		this.addCommand({
			id: "archive-migrate-sibling-to-central",
			name: "Migrate sibling archives to central",
			callback: () => this.openMigrateModal(),
		});

		this.addCommand({
			id: "archive-reconcile-stale-central",
			name: "Reconcile stale central archive folders",
			callback: () => this.reconcileStaleArchives(),
		});

		this.addSettingTab(new ArchiveSettingTab(this.app, this));
	}

	/** Migrate and reconcile move folders within the vault, so they need the central path there too. */
	centralPathInVault(): boolean {
		if (!isExternalPath(this.settings.centralArchivePath)) return true;
		new Notice("The central archive path is outside the vault; move files there yourself.");
		return false;
	}

	openMigrateModal() {
		if (!this.centralPathInVault()) return;
		new MigrateModal(this.app, this.settings).open();
	}

	private async reconcileStaleArchives() {
		if (!this.centralPathInVault()) return;
		const target = this.settings.centralArchivePath;
		const stale = findStaleCentralArchives(this.app, target);
		if (stale.length === 0) {
			new Notice("No stale central archives found.");
			return;
		}
		let okCount = 0;
		const failures: string[] = [];
		for (const s of stale) {
			const r = await reconcile(this.app, s.folderPath, target);
			if (r.ok) {
				okCount++;
			} else {
				const tail = "detail" in r && r.detail ? `: ${r.detail}` : "";
				failures.push(`${s.folderPath} (${r.reason})${tail}`);
			}
		}
		const summary = `Reconciled ${okCount}/${stale.length} stale archive(s) → ${target}.` +
			(failures.length ? ` Failures: ${failures.join("; ")}` : "");
		new Notice(summary);
	}

	private interceptMedia(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// Not awaited: Obsidian holds the whole note back until a returned promise
		// settles, and the server check behind it can take seconds, or longer in a
		// background window. Images are swapped once it answers.
		void redirectAllMedia(el, ctx.sourcePath, this.settings, this.app, this.server);
	}

	private async archiveMd(file: TFile): Promise<{ ok: number; transient: number; permanent: number }> {
		const content = await this.app.vault.read(file);
		const urls = extractUrls(content);
		let ok = 0;
		let transient = 0;
		let permanent = 0;
		for (const url of urls) {
			const dest = resolve(url, file.path, this.settings);
			try {
				const r: DownloadResult = await download(url, dest, this.app.vault, this.settings);
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
				console.debug(
					`[archive-redirect] ${processed}/${files.length}  (+${totalOk} ok, ${totalTransient} transient, ${totalPermanent} permanent)`,
				);
			}
		}
		new Notice(
			`Archive scan done: ${totalOk} downloaded, ${totalTransient} transient fails, ${totalPermanent} permanent fails.`,
		);
	}

	async loadSettings() {
		const raw = (await this.loadData()) ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
		// Migration: pre-v0.5 configs only had `archiveDirName`. Seed the new central
		// path with that value so a user who later flips to "central" mode keeps the
		// folder name they had been using, instead of getting a fresh "_archive".
		if (raw.archiveDirName && raw.centralArchivePath === undefined) {
			this.settings.centralArchivePath = raw.archiveDirName;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
