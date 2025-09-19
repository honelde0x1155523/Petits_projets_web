import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Route pour servir index.html à la racine
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});

// Route API pour relayer les requêtes à OpenAI
app.post("/api/chat", async (req, res) => {
	const { messages, model = "gpt-4o-mini" } = req.body;
	if (!process.env.OPENAI_API_KEY) {
		return res.status(500).json({ error: "Clé API manquante." });
	}
	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ model, messages }),
		});
		const data = await response.json();
		res.json(data);
	} catch (err) {
		res.status(500).json({ error: String(err) });
	}
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Serveur frontend + API disponible sur http://localhost:${PORT}`));
