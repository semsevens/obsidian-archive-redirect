import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ArchiveRedirectPlugin from "./main";
import { isExternalPath, type ArchiveMode, type SourceOrder } from "./settings";
import { findStaleCentralArchives, reconcile } from "./reconcile.ts";

export class ArchiveSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ArchiveRedirectPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Archive mode")
			.setDesc(
				"Sibling: each Markdown file gets its own _archive subfolder next to it. " +
					"Central: one shared folder at the vault root holds every cached file, deduped across notes.",
			)
			.addDropdown((dd) => {
				dd.addOption("sibling", "Sibling (per-note folder)");
				dd.addOption("central", "Central (one shared folder)");
				dd.setValue(this.plugin.settings.archiveMode).onChange(async (value) => {
					this.plugin.settings.archiveMode = value as ArchiveMode;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.archiveMode === "sibling") {
			new Setting(containerEl)
				.setName("Archive directory name")
				.setDesc("Subdirectory (sibling to each Markdown file) that holds cached resources.")
				.addText((text) =>
					text.setValue(this.plugin.settings.archiveDirName).onChange(async (value) => {
						this.plugin.settings.archiveDirName = value || "_archive";
						await this.plugin.saveSettings();
					}),
				);
		} else {
			new Setting(containerEl)
				.setName("Central archive path")
				.setDesc(
					"Folder that holds all cached files: vault-relative, or an absolute path " +
						"(or ~/…) outside the vault. " +
						"Files are bucketed by hash prefix (e.g. _archive/ab/abcd1234….jpg).",
				)
				.addText((text) =>
					text
						.setPlaceholder("_archive")
						.setValue(this.plugin.settings.centralArchivePath)
						.onChange(async (value) => {
							this.plugin.settings.centralArchivePath =
								value.trim().replace(/\/+$/, "") || "_archive";
							await this.plugin.saveSettings();
						}),
				);

			if (!isExternalPath(this.plugin.settings.centralArchivePath)) this.renderInVaultTools(containerEl);
		}

		this.renderServer(containerEl);
		this.renderRest(containerEl);
	}

	private renderInVaultTools(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Migrate sibling archives")
			.setDesc(
				"Find every per-note sibling archive folder in this vault and move (or copy) " +
					"its files into the central path above. Opens a preview before any file is touched.",
			)
			.addButton((b) =>
				b
					.setButtonText("Migrate now…")
					.setCta()
					.onClick(() => this.plugin.openMigrateModal()),
			);

		this.renderStaleArchives(containerEl);
	}

	private renderServer(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Server URL")
			.setDesc(
				"Base URL of a copy of the archive on a server, laid out like the central folder " +
					"(<url>/ab/abcd1234….jpg). Leave empty to use only the local archive.",
			)
			.addText((text) =>
				text
					.setPlaceholder("https://example.ts.net/library/_archive")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value.trim().replace(/\/+$/, "");
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Load order")
			.setDesc(
				"Which copy to show first. If it fails to load (server off, file not there yet), " +
					"the next one is tried; the original URL is always the last resort.",
			)
			.addDropdown((dd) => {
				dd.addOption("server-first", "Server → local → original");
				dd.addOption("local-first", "Local → server → original");
				dd.setValue(this.plugin.settings.sourceOrder).onChange(async (value) => {
					this.plugin.settings.sourceOrder = value as SourceOrder;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderStaleArchives(containerEl: HTMLElement): void {
		const stale = findStaleCentralArchives(this.app, this.plugin.settings.centralArchivePath);
		if (stale.length === 0) return;

		const target = this.plugin.settings.centralArchivePath;
		const intro = new Setting(containerEl)
			.setName("⚠ Stale central archives detected")
			.setDesc(
				`These folders contain the Archive Redirect marker but are not at the current central path (${target}). ` +
					"They were likely created by a previous setting and are no longer being served. Move each one to the current path:",
			);
		intro.settingEl.setCssStyles({ borderTop: "1px solid var(--background-modifier-border)" });

		for (const s of stale) {
			new Setting(containerEl)
				.setName(s.folderPath + "/")
				.setDesc(`Move into ${target}/`)
				.addButton((b) =>
					b
						.setButtonText("Move here")
						.setWarning()
						.onClick(async () => {
							const r = await reconcile(this.app, s.folderPath, target);
							if (r.ok) {
								new Notice(`Moved ${r.from} → ${r.to}`);
								this.display();
							} else {
								const tail = "detail" in r && r.detail ? `: ${r.detail}` : "";
								new Notice(`Reconcile failed (${r.reason})${tail}`);
							}
						}),
				);
		}
	}

	private renderRest(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Auto-archive on file modify")
			.setDesc("Scan and download new remote resources whenever a Markdown file is modified.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoArchiveOnModify).onChange(async (value) => {
					this.plugin.settings.autoArchiveOnModify = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Included paths")
			.setDesc("Only archive files under these vault-relative paths (one per line). Empty = entire vault.")
			.addTextArea((ta) => {
				ta.setValue(this.plugin.settings.includedPaths.join("\n"));
				ta.onChange(async (value) => {
					this.plugin.settings.includedPaths = value
						.split("\n")
						.map((s) => s.trim().replace(/\/+$/, ""))
						.filter((s) => s.length > 0);
					await this.plugin.saveSettings();
				});
				ta.inputEl.rows = 4;
				ta.inputEl.cols = 30;
			});
	}
}
