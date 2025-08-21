/* convoiturage_controller.js — Contrôleur */
(function (window) {
	"use strict";

	var Modele = window.ConvoiturageModele;
	var View = window.ConvoiturageView;

	// API publique
	window.initConvoiturage = function initConvoiturage(opts) {
		if (!opts || !opts.mount) throw new Error("initConvoiturage: {mount} requis.");

		var ui = View.createUI({ mount: opts.mount });

		// bornes de l'index d'arrêt saisi par l'utilisateur (1 = départ, N = arrivée)
		function refreshStopMax() {
			var stops = ui.collectStops(); // [ "Origine", ...escales..., "Destination" ]
			ui.groupsTbl.setMaxFor("stop", Math.max(1, stops.length)); // 1..N (N = nb arrêts totaux)
			ui.updateNLabels(stops.length); // maj "N" -> nombre contextuel
		}

		// Handlers
		ui.btnAddStop.button.addEventListener("click", function () {
			ui.stopsList.add({ label: "Nouvelle escale" });
			refreshStopMax();
		});

		// Si l'utilisateur modifie/supprime une escale via l'UI interne du listEditor
		ui.stopsHost.addEventListener("input", refreshStopMax);
		ui.stopsHost.addEventListener("change", refreshStopMax);
		ui.stopsHost.addEventListener("click", function () {
			// laisse le DOM se mettre à jour puis recalcule
			setTimeout(refreshStopMax, 0);
		});

		ui.btnAddCar.button.addEventListener("click", function () {
			ui.carsList.add({ capacity: 4, name: "" });
		});

		ui.cGroupCount.input.addEventListener("change", function () {
			ui.groupsTbl.setRowCount(Math.max(1, parseInt(ui.cGroupCount.input.value, 10) || 1));
			ui.groupsTbl.rerollRandoms();
		});

		ui.btnReg.button.addEventListener("click", function () {
			ui.groupsTbl.rerollRandoms();
		});

		ui.btnCompute.addEventListener("click", function () {
			var raw = ui.collectState();
			var check = Modele.validateState(raw);
			if (!check.ok) {
				window.GestionUI.alert(ui.spanAlert, "danger", check.message);
				ui.results.innerHTML = "";
				return;
			}
			var stateWithPeople = Modele.attachPeopleToGroups(raw);
			var itemsWrap = Modele.partitionGroups(stateWithPeople);
			var plan = Modele.assignItemsToTrips(itemsWrap.items, stateWithPeople);
			View.renderPlan(ui.results, plan, stateWithPeople);
			window.GestionUI.alert(ui.spanAlert, "success", "Plan généré.");
		});

		// Init bornes
		refreshStopMax();
	};
})(window);
