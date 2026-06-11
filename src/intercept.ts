import { App, TFile } from "obsidian";
import { resolve } from "./resolver";
import type { ArchiveSettings } from "./settings";

/** Walk an element's media nodes (img/video/audio/source) and rewrite remote src to local archive if present. */
export function redirectAllMedia(
	root: HTMLElement,
	sourcePath: string,
	settings: ArchiveSettings,
	app: App,
): number {
	let swapped = 0;
	root.querySelectorAll("img, video, audio, source").forEach((node) => {
		const src = node.getAttribute("src");
		if (!src || !src.startsWith("http")) return;
		const localPath = resolve(src, sourcePath, settings);
		const file = app.vault.getAbstractFileByPath(localPath);
		if (file instanceof TFile) {
			node.setAttribute("src", app.vault.getResourcePath(file));
			swapped++;
		}
	});
	return swapped;
}
