import { Vault, requestUrl } from "obsidian";
import { matchPolicy } from "./policies";

export type DownloadResult = "downloaded" | "skipped-exists" | "skipped-policy" | "failed";

export async function download(url: string, destPath: string, vault: Vault): Promise<DownloadResult> {
	if (await vault.adapter.exists(destPath)) return "skipped-exists";

	const policy = matchPolicy(url);
	if (!policy.archive) return "skipped-policy";

	const headers: Record<string, string> = {};
	if (policy.referer) headers.Referer = policy.referer;

	const response = await requestUrl({ url, headers, throw: false });
	if (response.status !== 200) {
		throw new Error(`HTTP ${response.status}`);
	}

	const dir = destPath.substring(0, destPath.lastIndexOf("/"));
	if (!(await vault.adapter.exists(dir))) {
		await vault.adapter.mkdir(dir);
	}
	await vault.adapter.writeBinary(destPath, response.arrayBuffer);
	return "downloaded";
}
