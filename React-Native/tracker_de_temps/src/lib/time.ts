// src/lib/time.ts
export const fmtHMS = (ms: number): string => {
	const t = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	const s = t % 60;
	return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

export const parseHMS = (str: string): number => {
	const p = str.split(":").map((n) => parseInt(n, 10) || 0);
	const [h, m = 0, s = 0] = p;
	return (h * 3600 + m * 60 + s) * 1000;
};

export const todayKey = (): string => new Date().toLocaleDateString("fr-FR").replace(/\//g, "-");
