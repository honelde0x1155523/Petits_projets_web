import express, { type Request, type Response } from "express";
import path from "path";
import { Runtime } from "./runtime";
import { Interpreter } from "./interpreter";

const app = express();
app.use(express.json());

// sert /public depuis la racine du projet
const projectRoot = path.resolve();
app.use(express.static(path.join(projectRoot, "public")));

app.post("/run", (req: Request, res: Response) => {
	const code: string = (req.body?.code ?? "") as string;
	const rt = new Runtime();
	const itp = new Interpreter(rt);
	try {
		const out = itp.run(code);
		res.json({ ok: true, output: out });
	} catch (e: any) {
		res.json({ ok: false, error: e.message });
	}
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Web UI: http://localhost:${PORT}`));
