import { App, TFile } from "obsidian";
import { resolve } from "./resolver";

/** Walk an element's media nodes (img/video/audio/source) and rewrite remote src to local archive if present. */
export function redirectAllMedia(
	root: HTMLElement,
	sourcePath: string,
	archiveDirName: string,
	app: App,
): number {
	let swapped = 0;
	root.querySelectorAll("img, video, audio, source").forEach((node) => {
		const src = node.getAttribute("src");
		if (!src || !src.startsWith("http")) return;
		const localPath = resolve(src, sourcePath, archiveDirName);
		const file = app.vault.getAbstractFileByPath(localPath);
		if (file instanceof TFile) {
			node.setAttribute("src", app.vault.getResourcePath(file));
			swapped++;
		}
	});
	return swapped;
}
