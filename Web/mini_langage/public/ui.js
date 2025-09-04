// Écrans
const screens = {
	menu: document.getElementById("menu"),
	editor: document.getElementById("editor"),
	output: document.getElementById("output"),
	guide: document.getElementById("guide"),
};
const menuItems = [...document.getElementById("menuList").querySelectorAll(".item")];
let selMenu = 0;

function show(name) {
	Object.values(screens).forEach((s) => s.classList.remove("active"));
	screens[name].classList.add("active");
	if (name === "editor") {
		if (!code.value.trim()) code.value = DEFAULT_PROGRAM.trimStart();
		code.focus();
	}
}
function renderMenu() {
	menuItems.forEach((el, i) => el.classList.toggle("sel", i === selMenu));
}
renderMenu();

// Neutraliser la souris (clavier only)
addEventListener("mousedown", (e) => e.preventDefault(), { capture: true });
addEventListener("click", (e) => e.preventDefault(), { capture: true });

// Guide
const GUIDE = [
	"Syntaxe MiniLang :",
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
	"Navigation :",
	"  Menu: ↑/↓, Entrée, Échap",
	"  Éditeur: P/p ouvre Mots-clés (flèches/Entrée/Échap), Ctrl+Entrée exécute",
].join("\n");
document.getElementById("guideText").textContent = GUIDE;

// Données palette mots-clés (catégories style TI)
const KEYWORDS = [
	{
		cat: "Déclarations",
		items: [
			{ label: "LET", insert: "LET " },
			{ label: "ARR", insert: "ARR A[2,2]" },
			{ label: "FUNC … END", insert: "FUNC f a\n  PRINT a\nEND" },
		],
	},
	{
		cat: "Instructions",
		items: [
			{ label: "PRINT", insert: 'PRINT "Texte"' },
			{ label: "SET", insert: "SET A[1,1] = 0" },
			{ label: "CALL", insert: "CALL f 1" },
		],
	},
	{
		cat: "Expressions",
		items: [
			{ label: "GET", insert: "GET A[1,1]" },
			{ label: "+ / -", insert: "x + 1" },
		],
	},
];

const DEFAULT_PROGRAM = `
# Tapez votre programme ici
LET x = 40 + 2
PRINT x
`.trim();

// Palette DOM
const palette = document.getElementById("palette");
const code = document.getElementById("code");
let paletteOpen = false;
let flatItems = []; // {catIdx, itemIdx, label, insert}
let selKw = 0;

// Construire la palette (liste plate avec en-têtes)
function buildPalette() {
	const parts = [];
	flatItems = [];
	let idx = 0;
	KEYWORDS.forEach((group, gi) => {
		parts.push(`<div class="cat">▸ ${group.cat}</div>`);
		group.items.forEach((it, ii) => {
			flatItems.push({ catIdx: gi, itemIdx: ii, label: it.label, insert: it.insert });
			parts.push(`<div class="kw${idx === 0 ? " sel" : ""}" data-i="${idx}">${it.label}</div>`);
			idx++;
		});
	});
	palette.innerHTML = parts.join("");
	selKw = 0;
}
buildPalette();

function openPalette() {
	palette.classList.add("open");
	palette.setAttribute("aria-hidden", "false");
	paletteOpen = true;
	highlightKw();
}
function closePalette() {
	palette.classList.remove("open");
	palette.setAttribute("aria-hidden", "true");
	paletteOpen = false;
	code.focus();
}
function highlightKw() {
	[...palette.querySelectorAll(".kw")].forEach((el, i) => el.classList.toggle("sel", i === selKw));
	palette.scrollTop = Math.max(0, palette.querySelector(".kw.sel")?.offsetTop - 60);
}

// Insérer du texte à la position du curseur
function insertAtCursor(textarea, text) {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const before = textarea.value.slice(0, start);
	const after = textarea.value.slice(end);
	textarea.value = before + text + after;
	const pos = start + text.length;
	textarea.selectionStart = textarea.selectionEnd = pos;
	textarea.focus();
}

// Actions globales
async function run() {
	const res = await fetch("/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.value }) });
	const j = await res.json();
	document.getElementById("out").textContent = j.ok ? j.output || "(aucune sortie)" : "Erreur: " + j.error;
	show("output");
}
function openEditor() {
	show("editor");
}
function openGuide() {
	show("guide");
}
function backToMenu() {
	show("menu");
	renderMenu();
}

// Gestion clavier globale
document.addEventListener("keydown", (e) => {
	const active = document.querySelector(".screen.active");

	// Écrans Menu/Output/Guide (comme avant)
	if (active === screens.menu) {
		if (e.key === "ArrowUp") {
			selMenu = (selMenu - 1 + menuItems.length) % menuItems.length;
			renderMenu();
		} else if (e.key === "ArrowDown") {
			selMenu = (selMenu + 1) % menuItems.length;
			renderMenu();
		} else if (e.key === "Enter") {
			if (selMenu === 0) openEditor();
			else if (selMenu === 1) run();
			else openGuide();
		} else if (e.key === "Escape") {
			/* rester */
		}
	} else if (active === screens.output) {
		if (e.key === "Escape") backToMenu();
		else if (e.key.toLowerCase() === "g") openGuide();
	} else if (active === screens.guide) {
		const g = document.getElementById("guideText");
		if (e.key === "ArrowDown") g.scrollTop += 24;
		else if (e.key === "ArrowUp") g.scrollTop -= 24;
		else if (e.key === "Escape") backToMenu();
	}

	// Écran Éditeur + Palette
	if (active === screens.editor) {
		// Ouverture / fermeture de la palette
		if (!paletteOpen && (e.key === "p" || e.key === "P")) {
			e.preventDefault();
			openPalette();
			return;
		}
		if (paletteOpen) {
			// Navigation palette
			if (e.key === "ArrowDown") {
				e.preventDefault();
				selKw = Math.min(selKw + 1, flatItems.length - 1);
				highlightKw();
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				selKw = Math.max(selKw - 1, 0);
				highlightKw();
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				insertAtCursor(code, flatItems[selKw].insert + "\n");
				closePalette();
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				closePalette();
				return;
			}
			// Empêcher autres touches d’écrire pendant la palette
			if (!["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
				e.preventDefault();
			}
			return;
		}
		// Palette fermée : édition standard clavier (textarea natif)
		if (e.key === "Escape") {
			e.preventDefault();
			backToMenu();
			return;
		}
		if (e.key === "Enter" && e.ctrlKey) {
			e.preventDefault();
			run();
			return;
		}
		// sinon: laisser le textarea gérer déplacement/effacement (← → ↑ ↓, Backspace, Delete, etc.)
	}
});

// Démarrage
show("menu");
