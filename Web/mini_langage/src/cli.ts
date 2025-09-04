import * as readline from "readline";
import { Runtime } from "./runtime";
import { Interpreter } from "./interpreter";
import { listPrograms, saveProgram, loadProgram, hasProgram, removeProgram } from "./storage";

type MenuItem = { label: string; action: () => Promise<void>; keys: string[] };

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
readline.emitKeypressEvents(process.stdin, rl as any);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

// État courant
let currentName: string | null = null;
let programBuffer = ``; // vide au départ

const rt = new Runtime();
const itp = new Interpreter(rt);

// ——— utilitaires UI ———
function waitKey(): Promise<any> {
	return new Promise((res) => {
		const onKey = (_s: any, key: any) => {
			process.stdin.off("keypress", onKey);
			res(key);
		};
		process.stdin.on("keypress", onKey);
	});
}

async function inputLine(prompt: string, validate?: (s: string) => string | null): Promise<string> {
	return new Promise((res) => {
		let buf = "";
		const render = () => {
			console.clear();
			console.log(prompt + "\n" + buf + "\n\n[Entrée=valider | Échap=annuler | Retour arrière=supprimer]");
		};
		render();
		const onData = (chunk: Buffer) => {
			const code = chunk[0];
			if (code === 0x1b) {
				// ESC
				process.stdin.off("data", onData);
				res("");
				return;
			}
			if (code === 0x7f) {
				buf = buf.slice(0, -1);
				render();
				return;
			}
			if (code === 0x0d) {
				// Enter
				if (validate) {
					const err = validate(buf);
					if (err) {
						console.clear();
						console.log(prompt + "\n" + buf + "\n\n" + err + "\n\nAppuyez sur une touche…");
						process.stdin.once("keypress", () => render());
						return;
					}
				}
				process.stdin.off("data", onData);
				res(buf.trim());
				return;
			}
			// A..Z / 0..9 / _ / - / espace / . etc. (on reste simple)
			const s = chunk.toString("utf8");
			buf += s;
			render();
		};
		process.stdin.on("data", onData);
	});
}

async function pause(msg = "Échap: retour menu"): Promise<void> {
	return new Promise((res) => {
		console.log("\n" + msg);
		const onKey = (_s: any, key: any) => {
			if (key?.name === "escape") {
				process.stdin.off("keypress", onKey);
				res();
			}
		};
		process.stdin.on("keypress", onKey);
	});
}

// ——— actions ———
async function runProgram() {
	console.clear();
	rt.output = [];
	try {
		const out = itp.run(programBuffer || "");
		console.log(out || "(aucune sortie)");
	} catch (e: any) {
		console.log("Erreur:", e.message);
	}
	await pause();
}

async function editProgram() {
	console.clear();
	console.log(`Édition "${currentName ?? "(non sauvegardé)"}" (Échap pour valider)\n`);
	console.log(programBuffer);
	let buf = programBuffer;
	const onKey = (chunk: Buffer) => {
		const code = chunk[0];
		if (code === 0x1b) {
			process.stdin.off("data", onKey);
			programBuffer = buf;
			return;
		} // ESC
		if (code === 0x7f) buf = buf.slice(0, -1);
		else if (code === 0x0d) buf += "\n";
		else buf += chunk.toString("utf8");
		console.clear();
		console.log(`Édition "${currentName ?? "(non sauvegardé)"}" (Échap pour valider)\n`);
		console.log(buf);
	};
	process.stdin.on("data", onKey);
	await pause();
}

async function newProgram() {
	const name = await inputLine("Nouveau programme — entrez un nom unique:", (s) => {
		if (!s.trim()) return "Nom requis.";
		if (/[^\w\-]/.test(s)) return "Utilisez lettres/chiffres/underscore/tiret.";
		if (hasProgram(s)) return "Nom déjà existant.";
		return null;
	});
	if (!name) return; // annulé
	currentName = name;
	programBuffer = ""; // vide
	try {
		saveProgram(name, programBuffer);
		console.clear();
		console.log(`Programme "${name}" créé.`);
	} catch (e: any) {
		console.clear();
		console.log("Erreur:", e.message);
	}
	await pause();
}

async function openProgram() {
	const list = listPrograms();
	if (!list.length) {
		console.clear();
		console.log("Aucun programme enregistré.");
		await pause();
		return;
	}
	let sel = 0;
	while (true) {
		console.clear();
		console.log("Ouvrir programme (↑/↓, Entrée, Échap)\n");
		list.forEach((n, i) => console.log(`${i === sel ? "> " : "  "}${n}`));
		const key = await waitKey();
		if (key.name === "escape") return;
		if (key.name === "up") sel = (sel - 1 + list.length) % list.length;
		else if (key.name === "down") sel = (sel + 1) % list.length;
		else if (key.name === "return") {
			const name = list[sel];
			currentName = name;
			programBuffer = loadProgram(name);
			console.clear();
			console.log(`Ouvert: ${name}`);
			await pause();
			return;
		}
	}
}

async function saveCurrent() {
	if (!currentName) {
		const name = await inputLine("Enregistrer sous — entrez un nom unique:", (s) => {
			if (!s.trim()) return "Nom requis.";
			if (/[^\w\-]/.test(s)) return "Utilisez lettres/chiffres/underscore/tiret.";
			if (hasProgram(s)) return "Nom déjà existant.";
			return null;
		});
		if (!name) return;
		currentName = name;
	}
	try {
		saveProgram(currentName, programBuffer);
		console.clear();
		console.log(`Sauvegardé: ${currentName}`);
	} catch (e: any) {
		console.clear();
		console.log("Erreur:", e.message);
	}
	await pause();
}

async function deleteProgram() {
	const list = listPrograms();
	if (!list.length) {
		console.clear();
		console.log("Aucun programme à supprimer.");
		await pause();
		return;
	}
	let sel = 0;
	while (true) {
		console.clear();
		console.log("Supprimer programme (↑/↓, Entrée pour supprimer, Échap pour annuler)\n");
		list.forEach((n, i) => console.log(`${i === sel ? "> " : "  "}${n}`));
		const key = await waitKey();
		if (key.name === "escape") return;
		if (key.name === "up") sel = (sel - 1 + list.length) % list.length;
		else if (key.name === "down") sel = (sel + 1) % list.length;
		else if (key.name === "return") {
			const name = list[sel];
			removeProgram(name);
			if (currentName === name) {
				currentName = null;
				programBuffer = "";
			}
			console.clear();
			console.log(`Supprimé: ${name}`);
			await pause();
			return;
		}
	}
}

async function viewGuide() {
	const GUIDE_TEXT = [
		"Guide MiniLang",
		"",
		"Mots-clés :",
		"  LET x = 3 + 4",
		'  PRINT "Texte" | PRINT x + 1',
		"  ARR A[2,3,4]",
		"  SET A[1,2,3] = 10 - 2",
		"  PRINT GET A[1,2,3]",
		"  FUNC f a",
		"    PRINT a + 1",
		"  END",
		"  CALL f 41",
		"",
		"Raccourcis: chiffres 1..9 et lettres A..Z. Échap=retour.",
	].join("\n");
	console.clear();
	console.log(GUIDE_TEXT);
	await pause();
}

// ——— menu principal (instantané, SANS attente de double-lettre) ———
async function main() {
	const items: MenuItem[] = [
		{ label: "1 • Nouveau programme [N]", action: newProgram, keys: ["1", "n"] },
		{ label: "2 • Ouvrir programme [O]", action: openProgram, keys: ["2", "o"] },
		{ label: "3 • Éditer programme [E]", action: editProgram, keys: ["3", "e"] },
		{ label: "4 • Exécuter [X]", action: runProgram, keys: ["4", "x"] },
		{ label: "5 • Enregistrer [S]", action: saveCurrent, keys: ["5", "s"] },
		{ label: "6 • Supprimer [D]", action: deleteProgram, keys: ["6", "d"] },
		{ label: "7 • Guide [G]", action: viewGuide, keys: ["7", "g"] },
		{
			label: "9 • Quitter [Q]",
			action: async () => {
				rl.close();
				process.exit(0);
			},
			keys: ["9", "q"],
		},
	];
	let sel = 0;

	while (true) {
		console.clear();
		console.log(`MiniLang – Menu (↑/↓, Entrée, Échap). Programme courant: ${currentName ?? "(non sauvegardé)"}\n`);
		items.forEach((it, i) => console.log(`${i === sel ? "> " : "  "}${it.label}`));
		const key = await waitKey();

		if (key.name === "escape") {
			rl.close();
			process.exit(0);
		} else if (key.name === "up") sel = (sel - 1 + items.length) % items.length;
		else if (key.name === "down") sel = (sel + 1) % items.length;
		else if (key.name === "return") await items[sel].action();
		else if (key.sequence) {
			const k = key.sequence.toLowerCase();
			const hit = items.find((it) => it.keys.includes(k));
			if (hit) await hit.action();
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
