export interface DomainPolicy {
	match: RegExp;
	archive: boolean;
	referer?: string;
	reason?: string;
}

export const DEFAULT_POLICIES: DomainPolicy[] = [
	{ match: /mmbiz\.qpic\.cn/, archive: true, referer: "https://mp.weixin.qq.com/" },
	{ match: /pbs\.twimg\.com/, archive: true },
	{ match: /video\.twimg\.com/, archive: true },
	{ match: /youtube\.com|youtu\.be/, archive: false, reason: "stream-only" },
	{ match: /vimeo\.com/, archive: false, reason: "stream-only" },
];

export function matchPolicy(url: string, policies: DomainPolicy[] = DEFAULT_POLICIES): DomainPolicy {
	for (const p of policies) {
		if (p.match.test(url)) return p;
	}
	return { match: /.*/, archive: true };
}
