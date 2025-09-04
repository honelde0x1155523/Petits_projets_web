export type Value = number | string;
export type NDArray = { dims: number[]; store: Map<string, number> };

export class Runtime {
	vars = new Map<string, Value>();
	arrays = new Map<string, NDArray>();
	functions = new Map<string, { arg: string; body: string[] }>();
	output: string[] = [];

	print(v: Value) {
		this.output.push(String(v));
	}
	getOutput(): string {
		return this.output.join("\n");
	}

	defineArray(name: string, dims: number[]) {
		this.arrays.set(name, { dims, store: new Map() });
	}
	keyFromIdx(idx: number[]): string {
		return idx.join(",");
	}

	setArray(name: string, idx: number[], val: number) {
		const arr = this.arrays.get(name);
		if (!arr) throw new Error(`Array ${name} non défini`);
		if (idx.length !== arr.dims.length) throw new Error(`Dimensions incorrectes`);
		for (let i = 0; i < idx.length; i++) {
			if (idx[i] < 1 || idx[i] > arr.dims[i]) throw new Error(`Index hors limites`);
		}
		arr.store.set(this.keyFromIdx(idx), val);
	}
	getArray(name: string, idx: number[]): number {
		const arr = this.arrays.get(name);
		if (!arr) throw new Error(`Array ${name} non défini`);
		const k = this.keyFromIdx(idx);
		const v = arr.store.get(k);
		if (v === undefined) throw new Error(`Case ${name}[${k}] vide`);
		return v;
	}
}
