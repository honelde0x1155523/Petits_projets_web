/* ascenseur_modele.js — Modèle (ES5, 2014) */
(function (window) {
	"use strict";

	var NAME_POOL = window.NOMS_POOL || [];
	var nameCounter = 0;

	function nextPersonName() {
		var base = NAME_POOL[nameCounter % NAME_POOL.length];
		var round = Math.floor(nameCounter / NAME_POOL.length);
		nameCounter++;
		return round === 0 ? base : base + " (" + (round + 1) + ")";
	}

	/* ========= logique métier ========= */
	function validateState(state) {
		if (!state.elevators || !state.elevators.length) return { ok: false, message: "Ajoutez au moins un ascenseur." };
		// Étages uniques
		var seen = {},
			i;
		for (i = 0; i < state.groups.length; i++) seen[state.groups[i].dest] = true;
		for (var k in seen)
			if (seen.hasOwnProperty(k)) {
				var f = parseInt(k, 10),
					ok = false;
				for (i = 0; i < state.elevators.length; i++) {
					if (elevatorCanServeFloor(state.elevators[i], f)) {
						ok = true;
						break;
					}
				}
				if (!ok) return { ok: false, message: "Aucun ascenseur ne dessert l’étage " + f + " (parité/hauteur)." };
			}
		return { ok: true };
	}

	function elevatorCanServeFloor(elevator, floor) {
		if (!elevator || elevator.maxFloor < floor) return false;
		if (elevator.evenOnly && floor % 2 !== 0) return false;
		if (elevator.oddOnly && floor % 2 !== 1) return false;
		return true;
	}

	function attachPeopleToGroups(state) {
		nameCounter = 0;
		var groups = [],
			i,
			p;
		for (i = 0; i < state.groups.length; i++) {
			var g = state.groups[i],
				people = [];
			for (p = 0; p < g.size; p++) people.push({ name: nextPersonName(), dest: g.dest, groupId: g.id });
			groups.push({ id: g.id, size: g.size, dest: g.dest, people: people });
		}
		return { floors: state.floors, elevators: state.elevators, groups: groups };
	}

	function partitionGroups(state) {
		var items = [],
			i,
			e;
		for (i = 0; i < state.groups.length; i++) {
			var g = state.groups[i],
				bestCap = 0;
			for (e = 0; e < state.elevators.length; e++) {
				var el = state.elevators[e];
				if (elevatorCanServeFloor(el, g.dest) && el.capacity > bestCap) bestCap = el.capacity;
			}
			if (g.size <= bestCap) {
				items.push({ groupId: g.id, partIndex: 1, parts: 1, size: g.size, dest: g.dest, people: g.people.slice(0) });
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
					items.push({ groupId: g.id, partIndex: p, parts: parts, size: take, dest: g.dest, people: slice, forced: true });
					remaining -= take;
					offset += take;
				}
			}
		}
		items.sort(function (a, b) {
			return b.dest - a.dest || b.size - a.size;
		});
		return { items: items };
	}

	function assignItemsToTrips(items, state) {
		var openTrips = [],
			trips = [],
			tCounter = 0;
		var tripsPerElevator = {},
			i,
			e;
		for (e = 0; e < state.elevators.length; e++) tripsPerElevator[state.elevators[e].id] = 0;

		for (i = 0; i < items.length; i++) {
			var it = items[i],
				best = null,
				bestWaste = Infinity,
				ot,
				t;
			for (ot = 0; ot < openTrips.length; ot++) {
				t = openTrips[ot];
				if (t.capLeft >= it.size && elevatorCanServeFloor(getElevatorById(state.elevators, t.elevatorId), it.dest)) {
					var waste = t.capLeft - it.size;
					if (waste < bestWaste) {
						bestWaste = waste;
						best = t;
					}
				}
			}
			var chosen = best;
			if (!chosen) {
				var chosenElev = null;
				for (e = 0; e < state.elevators.length; e++) {
					var el = state.elevators[e];
					if (!elevatorCanServeFloor(el, it.dest)) continue;
					if (!chosenElev) chosenElev = el;
					else if (el.capacity > chosenElev.capacity) chosenElev = el;
					else if (el.capacity === chosenElev.capacity && (tripsPerElevator[el.id] || 0) < (tripsPerElevator[chosenElev.id] || 0)) chosenElev = el;
				}
				chosen = { id: ++tCounter, elevatorId: chosenElev.id, capLeft: chosenElev.capacity, maxCap: chosenElev.capacity, stops: [], items: [] };
				openTrips.push(chosen);
				tripsPerElevator[chosenElev.id] = (tripsPerElevator[chosenElev.id] || 0) + 1;
			}
			chosen.items.push(it);
			chosen.capLeft -= it.size;
			addStopUnique(chosen.stops, it.dest);
			if (chosen.capLeft === 0) closeTrip(chosen);
		}
		for (var k = openTrips.length - 1; k >= 0; k--) closeTrip(openTrips[k]);

		function closeTrip(t) {
			t.stops.sort(function (a, b) {
				return a - b;
			});
			trips.push({ id: t.id, elevatorId: t.elevatorId, capacity: t.maxCap, stops: t.stops.slice(0), items: t.items.slice(0) });
			var idx = indexOfTrip(openTrips, t);
			if (idx >= 0) openTrips.splice(idx, 1);
		}
		trips.sort(function (a, b) {
			var d = a.elevatorId - b.elevatorId;
			return d !== 0 ? d : maxOfArray(b.stops) - maxOfArray(a.stops);
		});
		return trips;
	}

	/* ========= helpers (modèle) ========= */
	function addStopUnique(stops, floor) {
		for (var i = 0; i < stops.length; i++) if (stops[i] === floor) return;
		stops.push(floor);
	}
	function getElevatorById(arr, id) {
		for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
		return null;
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
	function clampInt(v, min, max) {
		var n = Math.floor(Number(v) || 0);
		if (n < min) n = min;
		if (n > max) n = max;
		return n;
	}

	/* ========= export ========= */
	window.AscenseurModele = {
		validateState: validateState,
		elevatorCanServeFloor: elevatorCanServeFloor,
		attachPeopleToGroups: attachPeopleToGroups,
		partitionGroups: partitionGroups,
		assignItemsToTrips: assignItemsToTrips,
		clampInt: clampInt,
		getElevatorById: getElevatorById,
	};
})(window);
