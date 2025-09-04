import { Runtime } from "./runtime";

type Tok = string;
function tokenize(line: string): Tok[] {
	const out: Tok[] = [];
	let i = 0;
	while (i < line.length) {
		const c = line[i];
		if (c === "#") break; // commentaire
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (c === '"') {
			let j = i + 1,
				s = "";
			while (j < line.length && line[j] !== '"') {
				s += line[j++];
			}
			if (j >= line.length) throw new Error("Guillemet non fermé");
			out.push(`" ${s}"`); // token texte (préfixé pour le distinguer)
			i = j + 1;
			continue;
		}
		if (/[A-Za-z_\[\],]/.test(c)) {
			out.push(c);
			i++;
			continue;
		}
		if (/[0-9+\-=/]/.test(c)) {
			out.push(c);
			i++;
			continue;
		}
		throw new Error(`Caractère invalide: ${c}`);
	}
	// regrouper identifiants/ nombres contigus
	return line.match(/"[^"]*"|[A-Za-z_]+|\[|\]|,|[0-9]+|[+\-=/]/g)?.filter((t) => t) ?? out;
}

function parseIndices(tokens: Tok[], start: number): { idx: number[]; next: number } {
	if (tokens[start] !== "[") throw new Error("Attendu '['");
	const idx: number[] = [];
	let i = start + 1;
	while (tokens[i] !== "]") {
		if (!/^[0-9]+$/.test(tokens[i])) throw new Error("Index entier attendu");
		idx.push(parseInt(tokens[i], 10));
		i++;
		if (tokens[i] === ",") i++;
	}
	return { idx, next: i + 1 };
}

export class Interpreter {
	constructor(private rt: Runtime) {}

	private evalExpr(tokens: Tok[], env: Map<string, number | string>): number | string {
		// Expressions très simples: entiers/variables/GET/ + -
		// Shunting-yard minimal pour + et - gauche→droite
		const toVal = (t: Tok): number | string => {
			if (/^"[^"]*"$/.test(t)) return t.slice(1); // retire le préfixe " et conserve texte
			if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
			if (/^[A-Za-z_][A-Za-z_0-9]*$/.test(t)) {
				const v = env.has(t) ? env.get(t) : this.rt.vars.get(t);
				if (v === undefined) throw new Error(`Var ${t} non définie`);
				return v!;
			}
			throw new Error(`Token expr invalide: ${t}`);
		};

		// Remplace séquences GET A[...]
		let i = 0;
		const flat: (Tok | number | string)[] = [];
		while (i < tokens.length) {
			if (tokens[i] === "GET") {
				const name = tokens[i + 1];
				const { idx, next } = parseIndices(tokens, i + 2);
				const v = this.rt.getArray(name, idx);
				flat.push(v);
				i = next;
			} else if (tokens[i] !== "=") {
				flat.push(tokens[i]);
				i++;
			} else i++;
		}

		// Évalue gauche→droite (uniquement + et -)
		let acc = toVal(String(flat[0]));
		for (let j = 1; j < flat.length; j += 2) {
			const op = flat[j];
			const rhs = toVal(String(flat[j + 1]));
			if (typeof acc === "string" || typeof rhs === "string") {
				if (op !== "+") throw new Error("Concat autorisée seulement avec +");
				acc = String(acc) + String(rhs);
			} else {
				if (op === "+") acc = acc + (rhs as number);
				else if (op === "-") acc = acc - (rhs as number);
				else throw new Error(`Opérateur inconnu: ${op}`);
			}
		}
		return acc;
	}

	run(program: string): string {
		const lines = program.split(/\r?\n/);
		const rt = this.rt;
		const funcs = rt.functions;

		// Pré-scan des fonctions
		for (let i = 0; i < lines.length; i++) {
			const raw = lines[i].trim();
			if (!raw) continue;
			const tokens = tokenize(raw);
			if (tokens[0] === "FUNC") {
				const name = tokens[1];
				const arg = tokens[2];
				const body: string[] = [];
				i++;
				while (i < lines.length && lines[i].trim() !== "END") {
					body.push(lines[i]);
					i++;
				}
				if (i >= lines.length) throw new Error("END manquant");
				funcs.set(name, { arg, body });
			}
		}

		// Exécution des lignes hors fonctions
		const execLines = lines.filter((l) => !/^FUNC\b/.test(l.trim()) && l.trim() !== "END");
		for (let pc = 0; pc < execLines.length; pc++) {
			const raw = execLines[pc].trim();
			if (!raw || raw.startsWith("#")) continue;
			const t = tokenize(raw);
			const head = t[0];

			if (head === "PRINT") {
				const val = this.evalExpr(t.slice(1), new Map());
				rt.print(val);
				continue;
			}

			if (head === "LET") {
				const name = t[1];
				const eq = t[2];
				if (eq !== "=") throw new Error("Syntaxe: LET x = expr");
				const val = this.evalExpr(t.slice(3), new Map());
				rt.vars.set(name, val);
				continue;
			}

			if (head === "ARR") {
				const name = t[1].replace(/\[.*/, "");
				const dims = raw
					.match(/\[(.*?)\]/)?.[1]
					.split(",")
					.map((s) => parseInt(s.trim(), 10));
				if (!dims || dims.some(isNaN)) throw new Error("Dimensions invalides");
				rt.defineArray(name, dims);
				continue;
			}

			if (head === "SET") {
				const name = t[1];
				const { idx, next } = parseIndices(t, 2);
				if (t[next] !== "=") throw new Error("SET … = expr attendu");
				const val = this.evalExpr(t.slice(next + 1), new Map());
				if (typeof val === "string") throw new Error("SET exige un nombre");
				rt.setArray(name, idx, val);
				continue;
			}

			if (head === "CALL") {
				const name = t[1];
				const fn = funcs.get(name);
				if (!fn) throw new Error(`Fonction ${name} inconnue`);
				const argVal = this.evalExpr(t.slice(2), new Map());
				const local = new Map<string, number | string>([[fn.arg, argVal]]);
				for (const line of fn.body) {
					const lt = tokenize(line.trim());
					if (!lt.length) continue;
					if (lt[0] === "PRINT") {
						const v = this.evalExpr(lt.slice(1), local);
						rt.print(v);
					} else if (lt[0] === "LET") {
						if (lt[2] !== "=") throw new Error("Syntaxe LET locale");
						const v = this.evalExpr(lt.slice(3), local);
						local.set(lt[1], v);
					} else if (lt[0] === "SET") {
						const nm = lt[1];
						const { idx, next } = parseIndices(lt, 2);
						const v = this.evalExpr(lt.slice(next + 1), local);
						if (typeof v === "string") throw new Error("SET exige un nombre");
						rt.setArray(nm, idx, v);
					} else if (lt[0] === "CALL") {
						// Appels imbriqués simples
						const callee = lt[1];
						const f2 = funcs.get(callee);
						if (!f2) throw new Error(`Fonction ${callee} inconnue`);
						const arg2 = this.evalExpr(lt.slice(2), local);
						const local2 = new Map<string, number | string>([[f2.arg, arg2]]);
						for (const l2 of f2.body) {
							const lt2 = tokenize(l2.trim());
							if (!lt2.length) continue;
							if (lt2[0] === "PRINT") {
								rt.print(this.evalExpr(lt2.slice(1), local2));
							}
						}
					} else {
						throw new Error(`Instruction inconnue en fonction: ${lt[0]}`);
					}
				}
				continue;
			}

			// GET utilisé seulement dans des expressions
			throw new Error(`Instruction inconnue: ${head}`);
		}
		return rt.getOutput();
	}
}
