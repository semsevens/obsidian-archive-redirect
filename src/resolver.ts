import { createHash } from "crypto";

export function resolve(url: string, mdPath: string, archiveDirName = "_archive"): string {
	const hash = createHash("sha1").update(url).digest("hex");
	const ext = guessExt(url);
	const dir = mdPath.substring(0, mdPath.lastIndexOf("/"));
	return `${dir}/${archiveDirName}/${hash}.${ext}`;
}

function guessExt(url: string): string {
	try {
		const u = new URL(url);
		const pathMatch = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
		if (pathMatch) return pathMatch[1].toLowerCase();
		const fmt = u.searchParams.get("wx_fmt");
		if (fmt) return fmt.toLowerCase();
	} catch {
		// fallthrough
	}
	return "bin";
}
