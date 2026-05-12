import { Vault, requestUrl } from "obsidian";
import { matchPolicy } from "./policies";

export type DownloadResult =
	| "downloaded"
	| "skipped-exists"
	| "skipped-policy"
	| "failed-permanent"
	| "failed-transient";

const RETRY_BACKOFFS_MS = [0, 1000, 3000]; // 3 次尝试: 立刻 / +1s / +3s
const REQUEST_TIMEOUT_MS = 15_000;
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 410, 451]);

export async function download(url: string, destPath: string, vault: Vault): Promise<DownloadResult> {
	if (await vault.adapter.exists(destPath)) return "skipped-exists";

	const policy = matchPolicy(url);
	if (!policy.archive) return "skipped-policy";

	// HTTP → HTTPS 自动升级（Obsidian requestUrl 不接受明文 HTTP）
	const fetchUrl = url.replace(/^http:\/\//, "https://");

	const headers: Record<string, string> = policy.referer ? { Referer: policy.referer } : {};

	let lastErr = "";
	let permanent = false;

	for (let i = 0; i < RETRY_BACKOFFS_MS.length; i++) {
		if (RETRY_BACKOFFS_MS[i] > 0) await sleep(RETRY_BACKOFFS_MS[i]);

		try {
			const response = await Promise.race([
				requestUrl({ url: fetchUrl, headers, throw: false }),
				rejectAfter<Awaited<ReturnType<typeof requestUrl>>>(REQUEST_TIMEOUT_MS),
			]);

			if (response.status === 200) {
				await writeFile(vault, destPath, response.arrayBuffer);
				return "downloaded";
			}

			if (PERMANENT_STATUSES.has(response.status)) {
				lastErr = `HTTP ${response.status} (permanent)`;
				permanent = true;
				break;
			}

			lastErr = `HTTP ${response.status}`;
		} catch (e: unknown) {
			lastErr = e instanceof Error ? e.message : String(e);
		}
	}

	await logFailure(vault, destPath, url, fetchUrl, lastErr);
	return permanent ? "failed-permanent" : "failed-transient";
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function rejectAfter<T>(ms: number): Promise<T> {
	return new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms));
}

async function writeFile(vault: Vault, destPath: string, buf: ArrayBuffer): Promise<void> {
	const dir = destPath.substring(0, destPath.lastIndexOf("/"));
	if (!(await vault.adapter.exists(dir))) await vault.adapter.mkdir(dir);
	await vault.adapter.writeBinary(destPath, buf);
}

async function logFailure(
	vault: Vault,
	destPath: string,
	originalUrl: string,
	fetchUrl: string,
	error: string,
): Promise<void> {
	const dir = destPath.substring(0, destPath.lastIndexOf("/"));
	if (!(await vault.adapter.exists(dir))) await vault.adapter.mkdir(dir);
	const logPath = `${dir}/.failed.jsonl`;
	const entry =
		JSON.stringify({
			url: originalUrl,
			fetchUrl: fetchUrl !== originalUrl ? fetchUrl : undefined,
			destPath,
			error,
			ts: new Date().toISOString(),
		}) + "\n";
	await vault.adapter.append(logPath, entry);
}
