/* convoiturage_view.js — Vue */
(function (window, document) {
	"use strict";

	function createUI(opts) {
		if (!opts || !opts.mount) throw new Error("ConvoiturageView.createUI: {mount} requis.");
		var mount = opts.mount;

		// Barre de paramètres générales
		var rowTop = document.createElement("div");
		rowTop.className = "row g-3 align-items-end mb-3";
		var cOrigin = colControl("Provenance", "text", "conv-origin", "Origine");
		var cDest = colControl("Destination", "text", "conv-dest", "Destination");
		var cStopCnt = colControl("Nombre d'escales (via +)", "number", "conv-stopCount", 0, { min: 0, readonly: true });
		rowTop.appendChild(cOrigin.col);
		rowTop.appendChild(cDest.col);
		rowTop.appendChild(cStopCnt.col);
		mount.appendChild(rowTop);

		// Escales (entre Origine et Destination)
		var stopsHost = document.createElement("div");
		mount.appendChild(stopsHost);
		var stopsList = window.GestionUI.listEditor(stopsHost, {
			title: "Escale",
			// 1 SEUL bouton : on supprime le bouton interne du listEditor
			addLabel: null,
			fields: [{ key: "label", label: "Nom de l'escale", type: "text", value: "Escale" }],
			initial: [],
			idKey: "id",
		});
		var btnAddStop = buttonControl("Ajouter une escale", "conv-btnAddStop", "btn btn-outline-primary mb-3");
		stopsHost.appendChild(btnAddStop.col);

		// Titre dynamique des groupes (on gère nous-mêmes le libellé avec N)
		var groupsTitle = document.createElement("h5");
		groupsTitle.id = "conv-groups-title";
		groupsTitle.className = "mt-3";
		mount.appendChild(groupsTitle);

		// Voitures
		var carsHost = document.createElement("div");
		mount.appendChild(carsHost);
		var carsList = window.GestionUI.listEditor(carsHost, {
			title: "Voiture",
			// 1) Supprime le bouton interne bleu -> un seul bouton (le nôtre)
			addLabel: null,
			fields: [
				{ key: "name", label: "Nom (optionnel)", type: "text", value: "" },
				{ key: "capacity", label: "Places", type: "number", min: 1, value: 4 },
			],
			initial: [{ name: "", capacity: 4 }],
			idKey: "id",
		});
		var btnAddCar = buttonControl("Ajouter une voiture", "conv-btnAddCar", "btn btn-outline-secondary mb-3");
		carsHost.appendChild(btnAddCar.col);

		// Helpers N dynamiques
		function countStopsTotal() {
			// N = Origine + escales + Destination
			var escalesCount = (stopsList.getData() || []).length;
			return 2 + escalesCount;
		}
		function mkStopLabel(N) {
			return "Arrêt (1 = départ, " + N + " = arrivée)";
		}

		// Groupes
		var rowMid = document.createElement("div");
		rowMid.className = "row g-3 align-items-end mb-3";
		var cGroupCnt = colControl("Nombre de groupes", "number", "conv-groupCount", 1, { min: 1 });
		var btnReg = buttonControl("Régénérer les groupes", "conv-btnRegenerateGroups", "btn btn-outline-secondary");
		rowMid.appendChild(cGroupCnt.col);
		rowMid.appendChild(btnReg.col);
		mount.appendChild(rowMid);

		var groupsHost = document.createElement("div");
		mount.appendChild(groupsHost);
		// libellés initiaux avec N courant
		var N0 = countStopsTotal();
		groupsTitle.textContent = "Groupes (" + mkStopLabel(N0) + ")";
		var groupsTbl = window.GestionUI.tableEditor(groupsHost, {
			title: "", // on gère notre titre à part (groupsTitle)
			rowLabel: "Groupe",
			initialRows: 1,
			columns: [
				// 2) Taille non bornée à 4
				{ key: "size", label: "Taille (personnes)", type: "number", min: 1, value: 1, defaultRandom: true },
				// 2) & 3) Libellé d'arrêt dynamique
				{ key: "stop", label: mkStopLabel(N0), type: "number", min: 1, value: 1, defaultRandom: true },
			],
			randomizeRow: function (col) {
				if (col.key === "size") return window.random_int(col.min || 1, col.max || 4); // random par défaut
				if (col.key === "stop") return 1; // max dynamique via setMaxFor côté contrôleur
				return "";
			},
		});

		// Actions & résultats
		var actions = document.createElement("div");
		actions.className = "sticky-actions border-top";
		var btnCompute = document.createElement("button");
		btnCompute.className = "btn btn-lg btn-primary";
		btnCompute.textContent = "Générer le plan";
		var spanAlert = document.createElement("span");
		spanAlert.id = "conv-computeAlert";
		spanAlert.className = "ms-3";
		actions.appendChild(btnCompute);
		actions.appendChild(spanAlert);
		mount.appendChild(actions);

		var results = document.createElement("div");
		results.id = "conv-results";
		results.className = "mt-4";
		mount.appendChild(results);

		function collectStops() {
			var origin = cOrigin.input.value || "Origine";
			var dest = cDest.input.value || "Destination";
			var escales = stopsList.getData().map(function (e) {
				return String(e.label || "Escale");
			});
			// compteur visuel (lecture seule) : nombre d'escales uniquement
			cStopCnt.input.value = String(escales.length);
			// Index humain: 1..N avec N = list.length (1=Origine, N=Destination)
			var list = [origin].concat(escales).concat([dest]);
			return list;
		}

		function collectState() {
			var stops = collectStops();
			var cars = carsList.getData().map(function (c) {
				return { id: c.id, capacity: Math.max(1, Math.floor(Number(c.capacity) || 1)), name: c.name || "Voiture #" + c.id };
			});
			var groupsHuman = groupsTbl.getData().map(function (g) {
				return { id: g.id, size: Math.max(1, Math.floor(Number(g.size) || 1)), stop: Math.max(1, Math.floor(Number(g.stop) || 1)) };
			});

			// Conversion "1 = départ … N = arrivée" -> interne 1..S (S = nb arrêts après l'origine)
			var S = Math.max(1, stops.length - 1); // 1..S (S inclut Destination)
			var groups = [];
			for (var i = 0; i < groupsHuman.length; i++) {
				var h = groupsHuman[i].stop; // 1..N
				var converted = Math.max(1, Math.min(h - 1, S)); // 1..S  (h-1 : on retire l'origine)
				groups.push({ id: groupsHuman[i].id, size: groupsHuman[i].size, stop: converted });
			}

			return { stops: stops, cars: cars, groups: groups };
		}

		// Mise à jour dynamique de "N" partout (titre + en-tête de colonne)
		function updateNLabels(N) {
			groupsTitle.textContent = "Groupes (" + mkStopLabel(N) + ")";
			// met à jour l'en-tête de colonne "stop" dans le thead rendu par tableEditor
			var thead = groupsHost.querySelector("thead");
			if (thead) {
				var ths = thead.querySelectorAll("th");
				for (var i = 0; i < ths.length; i++) {
					var th = ths[i];
					if (th.textContent.indexOf("Arrêt (") !== -1) {
						th.textContent = mkStopLabel(N);
						break;
					}
				}
			}
		}

		return {
			// exposés
			mount: mount,
			stopsHost: stopsHost,
			cOrigin: cOrigin,
			cDest: cDest,
			cStopCount: cStopCnt,
			stopsList: stopsList,
			btnAddStop: btnAddStop,
			carsList: carsList,
			btnAddCar: btnAddCar,
			cGroupCount: cGroupCnt,
			btnReg: btnReg,
			groupsTbl: groupsTbl,
			btnCompute: btnCompute,
			spanAlert: spanAlert,
			results: results,
			collectStops: collectStops,
			collectState: collectState,
			updateNLabels: updateNLabels,
		};
	}

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
			' <div class="col-auto"><div class="badge text-bg-primary p-3">Allers-retours totaux : <strong>' +
			trips.length +
			"</strong></div></div>" +
			' <div class="col-auto"><div class="badge text-bg-secondary p-3">Groupes séparés : <strong>' +
			actuallySplit +
			"</strong></div></div>" +
			' <div class="col-auto"><div class="badge text-bg-light border p-3">Arrêts (hors origine) : <strong>' +
			(state.stops.length - 1) +
			"</strong></div></div>" +
			"</div>";

		var thead =
			'<thead class="table-light"><tr>' +
			'<th style="width:70px;">#</th><th style="width:110px;">Voiture</th><th style="width:110px;">Capacité</th>' +
			'<th>Groupes embarqués</th><th style="width:260px;">Parcours</th><th style="width:220px;">Remarques</th>' +
			"</tr></thead>";

		var rows = "";
		for (t = 0; t < trips.length; t++) {
			var trip = trips[t];
			var car = getById(state.cars, trip.carId);
			var groupsHtml = "";
			for (i = 0; i < trip.items.length; i++) {
				var it = trip.items[i];
				var stopName = state.stops[it.stop]; // interne: 1..S => affiche bon libellé
				var title = "G" + it.groupId + (it.parts > 1 ? " (part " + it.partIndex + "/" + it.parts + ")" : "") + " : " + it.size + "p → " + stopName;
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

			var pathTxt =
				"Origine → " +
				trip.stops
					.map(function (s) {
						return state.stops[s];
					})
					.join(" → ") +
				" → Origine";
			var hasSplit = trip.items.some(function (it) {
				return it.parts > 1;
			});
			var remarks = [];
			if (hasSplit) remarks.push('<span class="group-split">Séparation nécessaire</span>');
			if (!trip.stops.length) remarks.push("—");

			rows +=
				"<tr>" +
				"<td>" +
				(t + 1) +
				"</td>" +
				"<td>#" +
				car.id +
				(car.name ? " — " + escapeHtml(car.name) : "") +
				"</td>" +
				"<td>" +
				trip.capacity +
				" p</td>" +
				"<td>" +
				groupsHtml +
				"</td>" +
				"<td>" +
				pathTxt +
				"</td>" +
				"<td>" +
				(remarks.length ? remarks.join("<br>") : "—") +
				"</td>" +
				"</tr>";
		}

		mount.innerHTML =
			kpis +
			'<div class="card"><div class="card-header">Séquence optimale (heuristique)</div>' +
			'<div class="card-body p-0"><div class="table-responsive"><table class="table table-striped table-hover align-middle table-fixed mb-0">' +
			thead +
			"<tbody>" +
			(rows || '<tr><td colspan="6" class="text-center text-muted">Aucun trajet nécessaire</td></tr>') +
			"</tbody></table></div></div>" +
			'<div class="card-footer text-muted">Objectif : minimiser les allers-retours puis éviter les séparations. Les groupes ne sont séparés que si les capacités le rendent inévitables.</div>' +
			"</div>";
	}

	/* ========== helpers vue ========== */
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
	function getById(arr, id) {
		for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
		return null;
	}
	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, function (m) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
		});
	}

	window.ConvoiturageView = { createUI: createUI, renderPlan: renderPlan };
})(window, document);
