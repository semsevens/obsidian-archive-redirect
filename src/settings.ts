import { App, PluginSettingTab, Setting } from "obsidian";
import type ArchiveRedirectPlugin from "./main";

export interface ArchiveSettings {
	archiveDirName: string;
	autoArchiveOnModify: boolean;
}

export const DEFAULT_SETTINGS: ArchiveSettings = {
	archiveDirName: "_archive",
	autoArchiveOnModify: true,
};

export class ArchiveSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ArchiveRedirectPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Archive directory name")
			.setDesc("Subdirectory (sibling to each markdown file) that holds cached resources.")
			.addText((text) =>
				text.setValue(this.plugin.settings.archiveDirName).onChange(async (value) => {
					this.plugin.settings.archiveDirName = value || "_archive";
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Auto-archive on file modify")
			.setDesc("Scan and download new remote resources whenever a markdown file is modified.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoArchiveOnModify).onChange(async (value) => {
					this.plugin.settings.autoArchiveOnModify = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
