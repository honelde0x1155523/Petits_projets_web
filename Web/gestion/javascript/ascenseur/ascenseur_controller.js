/* ascenseur_controller.js — Contrôleur (ES5, 2014) */
(function (window) {
	"use strict";

	var Modele = window.AscenseurModele;
	var View = window.AscenseurView;

	// API publique conservée
	window.initElevators = function initElevators(opts) {
		if (!opts || !opts.mount) throw new Error("initElevators: {mount} requis.");

		var ui = View.createUI({ mount: opts.mount });

		// Écouteurs
		ui.cFloors.input.addEventListener("change", function () {
			var max = Math.max(1, parseInt(ui.cFloors.input.value, 10) || 1);
			ui.elevList.setMaxFor("maxFloor", max);
			ui.groupsTbl.setMaxFor("dest", max);
		});

		ui.btnAdd.button.addEventListener("click", function () {
			const val = parseInt(ui.cFloors.input.value, 10) || 5;
			console.log(">>> Valeur lue dans #elev-floors :", ui.cFloors.input.value);
			console.log(">>> Valeur convertie utilisée pour maxFloor :", val);

			ui.elevList.setMaxFor("maxFloor", val);

			ui.elevList.add({
				capacity: 2,
				start: 0,
				maxFloor: val,
				evenOnly: false,
				oddOnly: false,
			});
		});

		ui.cGroups.input.addEventListener("change", function () {
			ui.groupsTbl.setRowCount(Math.max(1, parseInt(ui.cGroups.input.value, 10) || 1));
			ui.groupsTbl.rerollRandoms();
		});

		ui.btnReg.button.addEventListener("click", function () {
			ui.groupsTbl.rerollRandoms();
		});

		ui.btnCompute.addEventListener("click", function () {
			var stateRaw = ui.collectState();
			var validation = Modele.validateState(stateRaw);
			if (!validation.ok) {
				window.GestionUI.alert(ui.spanAlert, "danger", validation.message);
				ui.results.innerHTML = "";
				return;
			}
			var state = Modele.attachPeopleToGroups(stateRaw);
			var itemsWrap = Modele.partitionGroups(state);
			var plan = Modele.assignItemsToTrips(itemsWrap.items, state);
			View.renderPlan(ui.results, plan, state);
			window.GestionUI.alert(ui.spanAlert, "success", "Plan généré.");
		});
	};
})(window);
