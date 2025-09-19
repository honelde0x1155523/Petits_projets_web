import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { exec as execCb } from "child_process";
import fs from "fs/promises";
import "dotenv/config";

const exec = (cmd, opts = {}) =>
  new Promise((resolve, reject) =>
    execCb(cmd, opts, (err, stdout, stderr) =>
      err ? reject(new Error(stderr || stdout || String(err))) : resolve({ stdout, stderr })
    )
  );

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Utilitaires ----------
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}
function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}
async function writeJSON(p, obj) {
  const data = JSON.stringify(obj, null, 2);
  await fs.writeFile(p, data, "utf-8");
}
async function readJSON(p) {
  const txt = await fs.readFile(p, "utf-8");
  return JSON.parse(txt);
}

// ---------- OpenAI ----------
async function openAIChat(messages, model = "gpt-4o") {
  if (!process.env.OPENAI_API_KEY) throw new Error("Clé API manquante.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Erreur OpenAI");
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------- Mémoire process (index projets en cours) ----------
const projects = new Map();
/*
  projects.set(projectId, {
    id, rootDir, livrablesDir, metaPath, status: 'idle'|'running'|'paused'|'ended',
    config, currentSprint, maxTours, model
  })
*/

// ---------- Orchestration ----------
function computeOrder(config) {
  const roles = Array.isArray(config.roles) ? config.roles : [];
  const idToRole = new Map(roles.map((r) => [r.id, r]));
  const has = (id) => idToRole.has(id);
  const order = [];

  if (has("CHEF")) order.push("CHEF");
  if (has("MAN") || has("MANAGER")) order.push(has("MAN") ? "MAN" : "MANAGER");

  const rest = roles
    .map((r) => r.id)
    .filter((id) => !order.includes(id))
    .sort();

  return [...order, ...rest];
}

function buildSystemPrompt(config) {
  const goal = config?.project?.goal || "";
  const desc = config?.project?.description || "";
  const rolesTxt = (config.roles || [])
    .map((r) => `- ${r.id} (${r.name}): ${r.description || ""}`)
    .join("\n");
  return [
    {
      role: "system",
      content:
        "Tu es un orchestrateur de sprint agile strict. Réponds en français, concis, actionnable. " +
        "Chaque message doit faire avancer le sprint. Balise [FIN_SPRINT] quand les objectifs du sprint courant sont atteints.",
    },
    {
      role: "system",
      content:
        `Contexte projet:\nBut: ${goal}\nDescription: ${desc}\nRôles:\n${rolesTxt}\n` +
        "Rappels: pas de fioritures, propose tâches et décisions. Si tu es CHEF, fixe le cadre et objectif du sprint.",
    },
  ];
}

function buildRoleUserPrompt(roleId, config, conversation) {
  const role = (config.roles || []).find((r) => r.id === roleId);
  const name = role?.name || roleId;
  const brief = role?.description || "";
  const lastTurns = conversation.slice(-6).map((m) => `${m.roleId}: ${m.content}`).join("\n");
  return (
    `Tu parles au nom du rôle ${roleId} (${name}).\n` +
    `Ta description: ${brief}\n` +
    `Historique récent:\n${lastTurns || "(début)"}\n` +
    `Contrainte: 1 à 3 points courts max, ou un court paragraphe. Si tu es CHEF et que le sprint peut se conclure, ajoute [FIN_SPRINT].`
  );
}

async function ensureGitRepo(rootDir) {
  // Init si pas déjà un repo
  try {
    await fs.access(path.join(rootDir, ".git"));
  } catch {
    await exec("git init", { cwd: rootDir });
    await exec('git config user.email "simu@example.com"', { cwd: rootDir });
    await exec('git config user.name "SimuBot"', { cwd: rootDir });
    await exec("git add .", { cwd: rootDir });
    await exec('git commit -m "Initialisation projet"', { cwd: rootDir });
  }
}

async function commitIfChanged(rootDir, message) {
  await exec("git add .", { cwd: rootDir });
  const { stdout } = await exec("git status --porcelain", { cwd: rootDir });
  if (stdout.trim().length > 0) {
    await exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: rootDir });
  }
}

// ---------- API ----------
const app = express();
app.use(cors());
app.use(express.json());

// Sert index.html à la racine
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Init projet: crée dossier, meta, git, sprint=0
app.post("/api/project/init", async (req, res) => {
  try {
    const cfg = req.body?.config;
    if (!cfg?.project?.name) return res.status(400).json({ error: "config.project.name manquant" });

    const slug = slugify(cfg.project.name);
    const id = `${slug}_${nowStamp()}`;
    const rootDir = path.join(__dirname, "data", id);
    const livrablesDir = path.join(rootDir, "livrables");
    const metaPath = path.join(rootDir, "meta.json");

    await ensureDir(rootDir);
    await ensureDir(livrablesDir);

    const meta = {
      id,
      createdAt: new Date().toISOString(),
      status: "idle",
      currentSprint: 0,
      model: req.body?.model || "gpt-4o",
    };
    await writeJSON(metaPath, meta);

    // Écrire config brute
    await writeJSON(path.join(rootDir, "config.json"), cfg);

    await ensureGitRepo(rootDir);
    await commitIfChanged(rootDir, "Ajout configuration initiale");

    projects.set(id, {
      id,
      rootDir,
      livrablesDir,
      metaPath,
      status: "idle",
      config: cfg,
      currentSprint: 0,
      maxTours: 12,
      model: meta.model,
    });

    res.json({ projectId: id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Démarrer un sprint: crée fichier sprint-N.json et lance l’orchestrateur
app.post("/api/sprint/start", async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId || !projects.has(projectId)) return res.status(404).json({ error: "Projet introuvable" });
  const p = projects.get(projectId);

  try {
    // Charger meta depuis disque (source de vérité)
    const meta = await readJSON(p.metaPath);
    const sprintNum = meta.currentSprint + 1;
    const order = computeOrder(p.config);

    const sprintPath = path.join(p.rootDir, `sprint-${sprintNum}.json`);
    const sprint = {
      meta: {
        number: sprintNum,
        startedAt: new Date().toISOString(),
        status: "running",
      },
      order,
      messages: [], // {roleId, content, at}
    };
    await writeJSON(sprintPath, sprint);

    // MAJ meta
    meta.status = "running";
    meta.currentSprint = sprintNum;
    await writeJSON(p.metaPath, meta);

    // MAJ mémoire
    p.status = "running";
    p.currentSprint = sprintNum;

    // Lancer l’orchestration (async "fire-and-forget", le front pollera l’état)
    orchestrateSprint(p, sprintPath).catch(async (err) => {
      // En cas d’erreur, marquer le sprint en échec
      try {
        const s = await readJSON(sprintPath);
        s.meta.status = "error";
        s.meta.error = String(err);
        s.meta.endedAt = new Date().toISOString();
        await writeJSON(sprintPath, s);
        const metaNow = await readJSON(p.metaPath);
        metaNow.status = "idle";
        await writeJSON(p.metaPath, metaNow);
        p.status = "idle";
      } catch {}
      console.error("orchestrateSprint error:", err);
    });

    res.json({ ok: true, sprint: sprintNum, order });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

async function orchestrateSprint(p, sprintPath) {
  const config = p.config;
  const system = buildSystemPrompt(config);
  const order = (await readJSON(sprintPath)).order;
  const maxTours = p.maxTours;

  // Premier message : CHEF initie si présent, sinon premier de l’ordre
  let conversation = [];
  let tour = 0;
  let fin = false;

  while (!fin && tour < maxTours) {
    for (const roleId of order) {
      // Construire messages
      const userPrompt = buildRoleUserPrompt(roleId, config, conversation);
      const messages = [...system, ...conversation.map(m => ({
        role: "user", content: `${m.roleId}: ${m.content}`,
      })), { role: "user", content: userPrompt }];

      const content = await openAIChat(messages, p.model);
      const msg = { roleId, content, at: new Date().toISOString() };
      conversation.push(msg);

      // Persister incrémentalement
      const s = await readJSON(sprintPath);
      s.messages = conversation;
      await writeJSON(sprintPath, s);

      // Fin de sprint ?
      if (/\[FIN_SPRINT\]/i.test(content)) {
        fin = true;
        break;
      }
    }
    tour++;
  }

  // Clôture sprint
  const sFinal = await readJSON(sprintPath);
  sFinal.meta.status = "finished";
  sFinal.meta.endedAt = new Date().toISOString();
  await writeJSON(sprintPath, sFinal);

  // MAJ meta projet
  const meta = await readJSON(p.metaPath);
  meta.status = "idle";
  await writeJSON(p.metaPath, meta);
  p.status = "idle";

  // Commit livrables si présents
  await commitIfChanged(p.rootDir, `Fin sprint ${sFinal.meta.number}`);
}

// État projet (meta + dernier sprint)
app.get("/api/project/:id/state", async (req, res) => {
  const { id } = req.params;
  if (!projects.has(id)) return res.status(404).json({ error: "Projet introuvable" });
  const p = projects.get(id);

  try {
    const meta = await readJSON(p.metaPath);
    const sprintNum = meta.currentSprint;
    let sprint = null;
    if (sprintNum > 0) {
      const sprintPath = path.join(p.rootDir, `sprint-${sprintNum}.json`);
      try { sprint = await readJSON(sprintPath); } catch {}
    }
    res.json({ meta, sprint });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Sprint suivant (repart de l’état actuel)
app.post("/api/sprint/next", async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId || !projects.has(projectId)) return res.status(404).json({ error: "Projet introuvable" });
  // On réutilise /api/sprint/start
  req.body = { projectId };
  return app._router.handle(req, res, { method: "POST", url: "/api/sprint/start" });
});

// Pause / Fin projet
app.post("/api/project/pause", async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId || !projects.has(projectId)) return res.status(404).json({ error: "Projet introuvable" });
  const p = projects.get(projectId);
  const meta = await readJSON(p.metaPath);
  meta.status = "paused";
  await writeJSON(p.metaPath, meta);
  p.status = "paused";
  res.json({ ok: true });
});

app.post("/api/project/end", async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId || !projects.has(projectId)) return res.status(404).json({ error: "Projet introuvable" });
  const p = projects.get(projectId);
  const meta = await readJSON(p.metaPath);
  meta.status = "ended";
  await writeJSON(p.metaPath, meta);
  p.status = "ended";
  res.json({ ok: true });
});

// Sert index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Lancement serveur
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Serveur prêt sur http://localhost:${PORT}`)
);
