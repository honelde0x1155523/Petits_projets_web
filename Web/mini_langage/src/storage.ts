import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.resolve("data");
const LIST_FILE = path.join(DATA_DIR, "Programmes.txt");
const PROGS_DIR = path.join(DATA_DIR, "programmes");

function ensureDirs() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	if (!fs.existsSync(PROGS_DIR)) fs.mkdirSync(PROGS_DIR, { recursive: true });
	if (!fs.existsSync(LIST_FILE)) fs.writeFileSync(LIST_FILE, "", "utf8");
}

export function listPrograms(): string[] {
	ensureDirs();
	const raw = fs.readFileSync(LIST_FILE, "utf8");
	return raw
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function hasProgram(name: string): boolean {
	return listPrograms().includes(name);
}

export function saveProgram(name: string, content: string) {
	ensureDirs();
	if (/[^\w\-]/.test(name)) throw new Error("Nom invalide: utilisez lettres/chiffres/underscore/tiret");
	const file = path.join(PROGS_DIR, `${name}.txt`);
	fs.writeFileSync(file, content, "utf8");
	const set = new Set(listPrograms());
	set.add(name);
	fs.writeFileSync(LIST_FILE, [...set].sort().join("\n") + "\n", "utf8");
}

export function loadProgram(name: string): string {
	ensureDirs();
	const file = path.join(PROGS_DIR, `${name}.txt`);
	if (!fs.existsSync(file)) throw new Error(`Programme introuvable: ${name}`);
	return fs.readFileSync(file, "utf8");
}

export function removeProgram(name: string) {
	ensureDirs();
	const file = path.join(PROGS_DIR, `${name}.txt`);
	if (fs.existsSync(file)) fs.unlinkSync(file);
	const remaining = listPrograms().filter((n) => n !== name);
	fs.writeFileSync(LIST_FILE, remaining.join("\n") + (remaining.length ? "\n" : ""), "utf8");
}
