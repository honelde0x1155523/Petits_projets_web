/* ascenseur_view.js — Vue (ES5, 2014) */
(function (window, document) {
	"use strict";

	/* ========= construction UI ========= */
	function createUI(opts) {
		if (!opts || !opts.mount) throw new Error("AscenseurView.createUI: {mount} requis.");
		var mount = opts.mount;

		// Barre de paramètres
		var row = document.createElement("div");
		row.className = "row g-3 align-items-end mb-3";
		var cFloors = colControl("Nombre d'étages (0 à N)", "number", "elev-floors", 5, { min: 1 });
		var btnAdd = buttonControl("Ajouter un ascenseur", "elev-btnAddElevator", "btn btn-outline-primary");
		var cGroups = colControl("Nombre de groupes", "number", "elev-groupCount", 1, { min: 1 });
		var btnReg = buttonControl("Régénérer les groupes", "elev-btnRegenerateGroups", "btn btn-outline-secondary");
		row.appendChild(cFloors.col);
		row.appendChild(btnAdd.col);
		row.appendChild(cGroups.col);
		row.appendChild(btnReg.col);
		mount.appendChild(row);

		// Liste des ascenseurs
		var listHost = document.createElement("div");
		listHost.className = "mb-4";
		mount.appendChild(listHost);
		var elevList = window.GestionUI.listEditor(listHost, {
			title: "Ascenseur",
			addLabel: "Ajouter un ascenseur",
			fields: [
				{ key: "capacity", label: "Capacité max", type: "number", min: 1, value: 2 },
				{ key: "start", label: "Étage de départ", type: "number", min: 0, value: 0 },
				{ key: "maxFloor", label: "Étage max desservi", type: "number", min: 0, max: 5, value: 5 },
			],
			checks: [
				{ key: "evenOnly", label: "Dessert uniquement les étages pairs", exclusiveWith: "oddOnly" },
				{ key: "oddOnly", label: "Dessert uniquement les étages impairs", exclusiveWith: "evenOnly" },
			],
			initial: [{ capacity: 2, start: 0, maxFloor: 5, evenOnly: false, oddOnly: false }],
			idKey: "id",
		});

		// Groupes
		var groupsHost = document.createElement("div");
		mount.appendChild(groupsHost);
		var groupsTbl = window.GestionUI.tableEditor(groupsHost, {
			title: "Groupes (départ RDC = 0)",
			rowLabel: "Groupe",
			initialRows: 1,
			columns: [
				{ key: "size", label: "Taille (personnes)", type: "number", min: 1, max: 4, value: 1, defaultRandom: true },
				{ key: "dest", label: "Étage d'arrivée", type: "number", min: 1, value: 1, defaultRandom: true },
			],
			randomizeRow: function (col) {
				if (col.key === "size") return window.random_int(col.min || 1, col.max || 4);
				if (col.key === "dest") {
					var floors = parseInt(document.getElementById("elev-floors").value, 10) || 5;
					return window.random_int(col.min || 1, floors);
				}
				return "";
			},
		});

		// Actions
		var actions = document.createElement("div");
		actions.className = "sticky-actions border-top";
		var btnCompute = document.createElement("button");
		btnCompute.className = "btn btn-lg btn-primary";
		btnCompute.textContent = "Générer le résultat";
		var spanAlert = document.createElement("span");
		spanAlert.id = "elev-computeAlert";
		spanAlert.className = "ms-3";
		actions.appendChild(btnCompute);
		actions.appendChild(spanAlert);
		mount.appendChild(actions);

		// Résultats
		var results = document.createElement("div");
		results.id = "elev-results";
		results.className = "mt-4";
		mount.appendChild(results);

		function collectState() {
			var floors = Math.max(1, parseInt(cFloors.input.value, 10) || 1);
			var elevators = elevList.getData();
			for (var i = 0; i < elevators.length; i++) {
				if (elevators[i].maxFloor > floors) elevators[i].maxFloor = floors;
			}
			var groups = groupsTbl.getData();
			return { floors: floors, elevators: elevators, groups: groups };
		}

		return {
			mount: mount,
			cFloors: cFloors,
			btnAdd: btnAdd,
			cGroups: cGroups,
			btnReg: btnReg,
			btnCompute: btnCompute,
			spanAlert: spanAlert,
			results: results,
			elevList: elevList,
			groupsTbl: groupsTbl,
			collectState: collectState,
		};
	}

	/* ========= rendu ========= */
	function renderPlan(mount, trips, state) {
		var split = {},
			t,
			i;
		for (t = 0; t < trips.length; t++)
			for (i = 0; i < trips[t].items.length; i++) {
				var gid = trips[t].items[i].groupId;
				split[gid] = (split[gid] || 0) + 1;
			}
		var actuallySplit = 0;
		for (var g in split) if (split.hasOwnProperty(g) && split[g] > 1) actuallySplit++;

		var kpis =
			'<div class="row g-3 mb-3">' +
			' <div class="col-auto"><div class="badge text-bg-primary p-3">Allers‑retours totaux&nbsp;: <strong>' +
			trips.length +
			"</strong></div></div>" +
			' <div class="col-auto"><div class="badge text-bg-secondary p-3">Groupes séparés&nbsp;: <strong>' +
			actuallySplit +
			"</strong></div></div>" +
			' <div class="col-auto"><div class="badge text-bg-light border p-3">Étages max immeuble&nbsp;: <strong>' +
			state.floors +
			"</strong></div></div>" +
			"</div>";

		var thead =
			'<thead class="table-light"><tr>' +
			'<th style="width:70px;">#</th><th style="width:110px;">Ascenseur</th><th style="width:110px;">Capacité</th>' +
			'<th>Groupes embarqués</th><th style="width:210px;">Étages desservis</th><th style="width:220px;">Remarques</th>' +
			"</tr></thead>";

		var rows = "";
		for (t = 0; t < trips.length; t++) {
			var trip = trips[t];
			var e = getElevatorById(state.elevators, trip.elevatorId);
			var groupsHtml = "";
			for (i = 0; i < trip.items.length; i++) {
				var it = trip.items[i];
				var title = "G" + it.groupId + (it.parts > 1 ? " (part " + it.partIndex + "/" + it.parts + ")" : "") + " : " + it.size + "p → " + it.dest;
				var names = [];
				if (it.people) for (var n = 0; n < it.people.length; n++) names.push(it.people[n].name);
				groupsHtml +=
					'<div class="mb-2"><div>' +
					escapeHtml(title) +
					"</div>" +
					"<details><summary>" +
					it.size +
					" personne(s)</summary><small>" +
					(names.length ? escapeHtml(names.join(", ")) : "—") +
					"</small></details></div>";
			}
			var stopsTxt = trip.stops.length ? "0 → " + trip.stops.join(" → ") + " → 0" : "—";
			var remarks = [];
			if (e.start !== 0) remarks.push("Départ réel à l’étage " + e.start);
			if (e.evenOnly) remarks.push("Pairs uniquement");
			if (e.oddOnly) remarks.push("Impairs uniquement");
			var hasSplit = false;
			for (i = 0; i < trip.items.length; i++)
				if (trip.items[i].parts > 1) {
					hasSplit = true;
					break;
				}
			if (hasSplit) remarks.push('<span class="group-split">Séparation nécessaire</span>');

			rows +=
				"<tr><td>" +
				(t + 1) +
				"</td><td>#" +
				e.id +
				"</td><td>" +
				trip.capacity +
				" p</td>" +
				"<td>" +
				groupsHtml +
				"</td><td>" +
				stopsTxt +
				"</td><td>" +
				(remarks.length ? remarks.join("<br>") : "—") +
				"</td></tr>";
		}

		mount.innerHTML =
			kpis +
			'<div class="card"><div class="card-header">Séquence optimale (heuristique)</div>' +
			'<div class="card-body p-0"><div class="table-responsive"><table class="table table-striped table-hover align-middle table-fixed mb-0">' +
			thead +
			"<tbody>" +
			(rows || '<tr><td colspan="6" class="text-center text-muted">Aucun trajet nécessaire</td></tr>') +
			"</tbody></table></div></div>" +
			'<div class="card-footer text-muted">Objectif&nbsp;: minimiser les allers‑retours puis éviter les séparations. Les groupes ne sont séparés que si la capacité maximale des ascenseurs le rend inévitable.</div>' +
			"</div>";
	}

	/* ========= helpers (vue) ========= */
	function colControl(label, type, id, val, attrs) {
		var col = document.createElement("div");
		col.className = "col-auto";
		var lab = document.createElement("label");
		lab.className = "form-label";
		lab.setAttribute("for", id);
		lab.textContent = label;
		var inp = document.createElement("input");
		inp.className = "form-control";
		inp.id = id;
		inp.type = type || "text";
		inp.value = val || "";
		if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) inp.setAttribute(k, attrs[k]);
		col.appendChild(lab);
		col.appendChild(inp);
		return { col: col, input: inp };
	}
	function buttonControl(text, id, klass) {
		var col = document.createElement("div");
		col.className = "col-auto";
		var btn = document.createElement("button");
		btn.className = klass || "btn btn-secondary";
		btn.id = id;
		btn.type = "button";
		btn.textContent = text;
		col.appendChild(btn);
		return { col: col, button: btn };
	}
	function getElevatorById(arr, id) {
		for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
		return null;
	}
	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, function (m) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
		});
	}

	/* ========= export ========= */
	window.AscenseurView = {
		createUI: createUI,
		renderPlan: renderPlan,
	};
})(window, document);
