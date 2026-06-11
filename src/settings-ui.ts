import { App, PluginSettingTab, Setting } from "obsidian";
import type ArchiveRedirectPlugin from "./main";
import type { ArchiveMode } from "./settings";

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
					"Vault-relative folder that holds all cached files. " +
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
		}

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
