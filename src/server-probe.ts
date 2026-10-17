import { requestUrl } from "obsidian";

const PROBE_TIMEOUT_MS = 4_000;
// A server that answered is trusted for a while; one that didn't is asked
// again soon, so turning Tailscale on is noticed without a reload.
const UP_TTL_MS = 5 * 60_000;
const DOWN_TTL_MS = 30_000;

/**
 * Whether the archive server can be reached right now. Checked once and
 * remembered, so a page of images doesn't each wait out a timeout when the
 * server is off (Tailscale down, machine asleep).
 */
export class ServerProbe {
	private last: { base: string; up: boolean; at: number } | null = null;
	private pending: { base: string; result: Promise<boolean> } | null = null;

	reachable(base: string): Promise<boolean> {
		base = base.trim().replace(/\/+$/, "");
		if (!base) return Promise.resolve(false);
		const last = this.last;
		if (last && last.base === base && Date.now() - last.at < (last.up ? UP_TTL_MS : DOWN_TTL_MS)) {
			return Promise.resolve(last.up);
		}
		if (this.pending?.base === base) return this.pending.result;
		const result = probe(base).then((up) => {
			this.last = { base, up, at: Date.now() };
			if (this.pending?.base === base) this.pending = null;
			return up;
		});
		this.pending = { base, result };
		return result;
	}
}

/** Any HTTP answer counts: the server is there, whatever it says about `/`. */
async function probe(base: string): Promise<boolean> {
	let timer: number | undefined;
	try {
		return await Promise.race([
			requestUrl({ url: base + "/", method: "HEAD", throw: false }).then(() => true),
			new Promise<boolean>((r) => {
				timer = window.setTimeout(() => r(false), PROBE_TIMEOUT_MS);
			}),
		]);
	} catch {
		return false;
	} finally {
		window.clearTimeout(timer);
	}
}
