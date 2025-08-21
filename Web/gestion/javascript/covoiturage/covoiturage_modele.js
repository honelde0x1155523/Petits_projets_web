/* convoiturage_modele.js — Modèle */
(function (window) {
	"use strict";

	var NAME_POOL = window.NOMS_POOL || [];
	var nameCounter = 0;

	function nextPersonName() {
		var base = NAME_POOL[nameCounter % NAME_POOL.length] || "Personne " + (nameCounter + 1);
		var round = Math.floor(nameCounter / NAME_POOL.length);
		nameCounter++;
		return round === 0 ? base : base + " (" + (round + 1) + ")";
	}

	/* ====== validation ====== */
	function validateState(state) {
		if (!state.cars || !state.cars.length) return { ok: false, message: "Ajoutez au moins une voiture." };
		if (!state.stops || state.stops.length < 2) return { ok: false, message: "Définissez au minimum Origine et Destination." };
		var S = state.stops.length - 1;
		for (var i = 0; i < state.groups.length; i++) {
			var st = parseInt(state.groups[i].stop, 10);
			if (!(st >= 1 && st <= S)) return { ok: false, message: "Un groupe a un arrêt invalide (doit être entre 1 et " + S + ")." };
		}
		return { ok: true };
	}

	/* ====== people attach ====== */
	function attachPeopleToGroups(state) {
		nameCounter = 0;
		var groups = [],
			i,
			p;
		for (i = 0; i < state.groups.length; i++) {
			var g = state.groups[i],
				people = [];
			for (p = 0; p < g.size; p++) people.push({ name: nextPersonName(), stop: g.stop, groupId: g.id });
			groups.push({ id: g.id, size: g.size, stop: g.stop, people: people });
		}
		return { stops: state.stops, cars: state.cars, groups: groups };
	}

	/* ====== partition (éviter la séparation sauf contrainte capacité) ====== */
	function partitionGroups(state) {
		var items = [],
			i,
			c;
		var bestCap = 0;
		for (c = 0; c < state.cars.length; c++) if (state.cars[c].capacity > bestCap) bestCap = state.cars[c].capacity;

		for (i = 0; i < state.groups.length; i++) {
			var g = state.groups[i];
			if (g.size <= bestCap) {
				items.push({ groupId: g.id, partIndex: 1, parts: 1, size: g.size, stop: g.stop, people: g.people.slice(0) });
			} else {
				var parts = Math.ceil(g.size / bestCap),
					remaining = g.size,
					offset = 0,
					p,
					take,
					slice;
				for (p = 1; p <= parts; p++) {
					take = Math.min(bestCap, remaining);
					slice = g.people.slice(offset, offset + take);
					items.push({ groupId: g.id, partIndex: p, parts: parts, size: take, stop: g.stop, people: slice, forced: true });
					remaining -= take;
					offset += take;
				}
			}
		}
		// trier par arrêt le plus loin puis par taille décroissante
		items.sort(function (a, b) {
			return b.stop - a.stop || b.size - a.size;
		});
		return { items: items };
	}

	/* ====== assignation en trajets (min allers-retours puis compacité) ====== */
	function assignItemsToTrips(items, state) {
		var openTrips = [],
			trips = [],
			tCounter = 0;
		var tripsPerCar = {},
			i,
			c;

		for (c = 0; c < state.cars.length; c++) tripsPerCar[state.cars[c].id] = 0;

		for (i = 0; i < items.length; i++) {
			var it = items[i],
				best = null,
				bestWaste = Infinity,
				ot,
				t;

			// Essayer de remplir un trajet ouvert
			for (ot = 0; ot < openTrips.length; ot++) {
				t = openTrips[ot];
				if (t.capLeft >= it.size) {
					var waste = t.capLeft - it.size;
					if (waste < bestWaste) {
						bestWaste = waste;
						best = t;
					}
				}
			}

			var chosen = best;
			if (!chosen) {
				// ouvrir un nouveau trajet sur la plus grande capacité disponible (ou la moins chargée ex æquo)
				var chosenCar = null;
				for (c = 0; c < state.cars.length; c++) {
					var car = state.cars[c];
					if (!chosenCar) chosenCar = car;
					else if (car.capacity > chosenCar.capacity) chosenCar = car;
					else if (car.capacity === chosenCar.capacity && (tripsPerCar[car.id] || 0) < (tripsPerCar[chosenCar.id] || 0)) chosenCar = car;
				}
				chosen = { id: ++tCounter, carId: chosenCar.id, capLeft: chosenCar.capacity, maxCap: chosenCar.capacity, stops: [], items: [] };
				openTrips.push(chosen);
				tripsPerCar[chosenCar.id] = (tripsPerCar[chosenCar.id] || 0) + 1;
			}

			chosen.items.push(it);
			chosen.capLeft -= it.size;
			addStopUnique(chosen.stops, it.stop);

			if (chosen.capLeft === 0) closeTrip(chosen);
		}

		// fermer les trajets restants
		for (var k = openTrips.length - 1; k >= 0; k--) closeTrip(openTrips[k]);

		function closeTrip(t) {
			// Les arrêts se font dans l’ordre croissant (du plus proche au plus lointain), Origine implicite (0)
			t.stops.sort(function (a, b) {
				return a - b;
			});
			trips.push({ id: t.id, carId: t.carId, capacity: t.maxCap, stops: t.stops.slice(0), items: t.items.slice(0) });
			var idx = indexOfTrip(openTrips, t);
			if (idx >= 0) openTrips.splice(idx, 1);
		}

		// ordre d’affichage : par voiture puis par arrêt max desservi
		trips.sort(function (a, b) {
			var d = a.carId - b.carId;
			return d !== 0 ? d : maxOfArray(b.stops) - maxOfArray(a.stops);
		});
		return trips;
	}

	/* ====== helpers ====== */
	function addStopUnique(stops, s) {
		for (var i = 0; i < stops.length; i++) if (stops[i] === s) return;
		stops.push(s);
	}
	function indexOfTrip(arr, t) {
		for (var i = 0; i < arr.length; i++) if (arr[i] === t) return i;
		return -1;
	}
	function maxOfArray(a) {
		if (!a.length) return -Infinity;
		var m = a[0];
		for (var i = 1; i < a.length; i++) if (a[i] > m) m = a[i];
		return m;
	}

	window.ConvoiturageModele = {
		validateState: validateState,
		attachPeopleToGroups: attachPeopleToGroups,
		partitionGroups: partitionGroups,
		assignItemsToTrips: assignItemsToTrips,
	};
})(window);
