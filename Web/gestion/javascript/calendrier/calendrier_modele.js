(function (window) {
	"use strict";
	var STORAGE_KEY = "calendrier_personnel";

	function nowFrLabel() {
		var d = new Date();
		var date = d.toLocaleDateString("fr-FR");
		var time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
		return date + " " + time;
	}
	function uid() {
		return "e" + Math.random().toString(36).slice(2, 10);
	}

	function loadAll() {
		try {
			var raw = window.localStorage.getItem(STORAGE_KEY);
			var obj = raw ? JSON.parse(raw) : { profils: {}, currentProfileKey: null };
			if (!obj || typeof obj !== "object") obj = { profils: {}, currentProfileKey: null };
			var profils = obj.profils || {};
			for (var k in profils)
				if (Object.prototype.hasOwnProperty.call(profils, k)) {
					var p = profils[k] || {};
					if (!Array.isArray(p.events)) p.events = [];
					for (var i = 0; i < p.events.length; i++) {
						var ev = p.events[i];
						if (!Array.isArray(ev.subtasks)) ev.subtasks = [];
						if (!Array.isArray(ev.tasks)) ev.tasks = []; // tâches par évènement
					}
					profils[k] = p;
				}
			obj.profils = profils;
			return obj;
		} catch (e) {
			return { profils: {}, currentProfileKey: null };
		}
	}
	function saveAll(state) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	}

	function nextProfilNumber(state) {
		var max = 0,
			keys = Object.keys(state.profils || {});
		for (var i = 0; i < keys.length; i++) {
			var p = state.profils[keys[i]];
			var m = /^Profil\s+(\d+)$/.exec(p && p.name);
			if (m) max = Math.max(max, parseInt(m[1], 10));
		}
		return max + 1;
	}

	function createProfile(state, name) {
		var label = String(name || "Profil " + nextProfilNumber(state)).trim();
		var createdFr = nowFrLabel();
		var subKey = label + " — créé le " + createdFr;
		if (state.profils[subKey]) subKey += " #" + Math.floor(Math.random() * 1000);
		state.profils[subKey] = {
			name: label,
			createdFr: createdFr,
			createdISO: new Date().toISOString(),
			events: [], // chaque évènement contient ses propres tasks[]
		};
		state.currentProfileKey = subKey;
		return subKey;
	}
	function renameProfile(state, key, newName) {
		if (!state.profils[key]) return;
		var label = String(newName || "").trim();
		if (!label) return;
		state.profils[key].name = label;
	}
	function deleteProfile(state, key) {
		if (state.profils[key]) {
			delete state.profils[key];
			state.currentProfileKey = Object.keys(state.profils)[0] || null;
		}
	}
	function setCurrentProfile(state, key) {
		if (state.profils[key]) state.currentProfileKey = key;
	}
	function getCurrentProfile(state) {
		if (!state.currentProfileKey) return null;
		return state.profils[state.currentProfileKey] || null;
	}

	/* ======== Évènements ======== */
	function addEvent(state, profileKey, evt) {
		evt.id = uid();
		if (!Array.isArray(evt.subtasks)) evt.subtasks = [];
		if (!Array.isArray(evt.tasks)) evt.tasks = []; // initialise conteneur de tâches
		state.profils[profileKey].events.push(evt);
		return evt.id;
	}
	function updateEvent(state, profileKey, evt) {
		var list = state.profils[profileKey].events;
		for (var i = 0; i < list.length; i++)
			if (list[i].id === evt.id) {
				// préserver tasks si non fourni
				if (!Array.isArray(evt.tasks)) evt.tasks = Array.isArray(list[i].tasks) ? list[i].tasks : [];
				if (!Array.isArray(evt.subtasks)) evt.subtasks = Array.isArray(list[i].subtasks) ? list[i].subtasks : [];
				list[i] = evt;
				return true;
			}
		return false;
	}
	function deleteEvent(state, profileKey, id) {
		var list = state.profils[profileKey].events;
		for (var i = list.length - 1; i >= 0; i--) if (list[i].id === id) list.splice(i, 1);
	}
	function listEventsOnDay(profile, y, m, d) {
		var out = [];
		for (var i = 0; i < profile.events.length; i++) {
			var e = profile.events[i];
			var dt = new Date(e.startISO);
			if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) out.push(e);
		}
		out.sort(function (a, b) {
			return +new Date(a.startISO) - +new Date(b.startISO);
		});
		return out;
	}
	function detectOverlap(profile, evt) {
		var s = +new Date(evt.startISO),
			e = +new Date(evt.endISO);
		for (var i = 0; i < profile.events.length; i++) {
			var it = profile.events[i];
			if (it.id === evt.id) continue;
			var s2 = +new Date(it.startISO),
				e2 = +new Date(it.endISO);
			if (Math.max(s, s2) < Math.min(e, e2)) return it;
		}
		return null;
	}
	function proposeMove(profile, evt) {
		var start = new Date(evt.startISO),
			end = new Date(evt.endISO);
		var day = start.getDate(),
			mon = start.getMonth(),
			yr = start.getFullYear();
		for (var tries = 48; tries-- > 0; ) {
			var clash = detectOverlap(profile, { id: evt.id, startISO: start.toISOString(), endISO: end.toISOString() });
			if (!clash && start.getDate() === day && start.getMonth() === mon && start.getFullYear() === yr) {
				return { startISO: start.toISOString(), endISO: end.toISOString() };
			}
			start = new Date(+start + 30 * 60000);
			end = new Date(+end + 30 * 60000);
		}
		return null;
	}
	function planBetween(profile, eventIdA, eventIdB, draft) {
		var A = null,
			B = null;
		for (var i = 0; i < profile.events.length; i++) {
			if (profile.events[i].id === eventIdA) A = profile.events[i];
			if (profile.events[i].id === eventIdB) B = profile.events[i];
		}
		if (!A || !B) return null;
		var aEnd = +new Date(A.endISO),
			bStart = +new Date(B.startISO);
		if (bStart <= aEnd) return null;
		var mid = new Date((aEnd + bStart) / 2);
		var durMin = Math.max(15, draft.durationMin || 30);
		var start = new Date(+mid - (durMin * 60000) / 2);
		var end = new Date(+start + durMin * 60000);
		return { startISO: start.toISOString(), endISO: end.toISOString() };
	}
	function expandIntoSubtasks(evt, n) {
		n = Math.max(1, Math.floor(Number(n) || 0));
		var subs = [];
		for (var i = 1; i <= n; i++) subs.push({ id: uid(), label: "Sous-tâche " + i, done: false });
		evt.subtasks = subs;
		return evt;
	}
	function getEventById(state, profileKey, eventId) {
		var list = (state.profils[profileKey] || {}).events || [];
		for (var i = 0; i < list.length; i++) if (list[i].id === eventId) return list[i];
		return null;
	}

	/* ======== Tâches PAR ÉVÈNEMENT ======== */
	function addTaskToEvent(state, profileKey, eventId, title) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev) return null;
		if (!Array.isArray(ev.tasks)) ev.tasks = [];
		var t = { id: uid(), title: String(title || "").trim() || "Nouvelle tâche", done: false, comments: [] };
		ev.tasks.push(t);
		return t.id;
	}
	function updateTaskTitleInEvent(state, profileKey, eventId, taskId, title) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev || !Array.isArray(ev.tasks)) return;
		for (var i = 0; i < ev.tasks.length; i++)
			if (ev.tasks[i].id === taskId) {
				ev.tasks[i].title = String(title || "").trim();
				return;
			}
	}
	function toggleTaskInEvent(state, profileKey, eventId, taskId, done) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev || !Array.isArray(ev.tasks)) return;
		for (var i = 0; i < ev.tasks.length; i++)
			if (ev.tasks[i].id === taskId) {
				ev.tasks[i].done = !!done;
				return;
			}
	}
	function deleteTaskInEvent(state, profileKey, eventId, taskId) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev || !Array.isArray(ev.tasks)) return;
		for (var i = ev.tasks.length - 1; i >= 0; i--)
			if (ev.tasks[i].id === taskId) {
				ev.tasks.splice(i, 1);
				return;
			}
	}
	function addCommentInEvent(state, profileKey, eventId, taskId, text) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev || !Array.isArray(ev.tasks)) return;
		for (var i = 0; i < ev.tasks.length; i++)
			if (ev.tasks[i].id === taskId) {
				ev.tasks[i].comments.push({ id: uid(), text: String(text || "").trim(), createdISO: new Date().toISOString() });
				return;
			}
	}
	function updateCommentInEvent(state, profileKey, eventId, taskId, commentId, text) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev || !Array.isArray(ev.tasks)) return;
		for (var i = 0; i < ev.tasks.length; i++)
			if (ev.tasks[i].id === taskId) {
				var cs = ev.tasks[i].comments;
				for (var j = 0; j < cs.length; j++)
					if (cs[j].id === commentId) {
						cs[j].text = String(text || "").trim();
						cs[j].updatedISO = new Date().toISOString();
						return;
					}
			}
	}
	function deleteCommentInEvent(state, profileKey, eventId, commentId) {
		var ev = getEventById(state, profileKey, eventId);
		if (!ev || !Array.isArray(ev.tasks)) return;
		for (var i = 0; i < ev.tasks.length; i++) {
			var cs = ev.tasks[i].comments;
			for (var j = cs.length - 1; j >= 0; j--)
				if (cs[j].id === commentId) {
					cs.splice(j, 1);
					return;
				}
		}
	}

	window.CalendrierModele = {
		STORAGE_KEY: STORAGE_KEY,
		loadAll: loadAll,
		saveAll: saveAll,
		createProfile: createProfile,
		renameProfile: renameProfile,
		deleteProfile: deleteProfile,
		setCurrentProfile: setCurrentProfile,
		getCurrentProfile: getCurrentProfile,
		addEvent: addEvent,
		updateEvent: updateEvent,
		deleteEvent: deleteEvent,
		listEventsOnDay: listEventsOnDay,
		detectOverlap: detectOverlap,
		proposeMove: proposeMove,
		planBetween: planBetween,
		expandIntoSubtasks: expandIntoSubtasks,
		// tâches par évènement
		addTaskToEvent: addTaskToEvent,
		updateTaskTitleInEvent: updateTaskTitleInEvent,
		toggleTaskInEvent: toggleTaskInEvent,
		deleteTaskInEvent: deleteTaskInEvent,
		addCommentInEvent: addCommentInEvent,
		updateCommentInEvent: updateCommentInEvent,
		deleteCommentInEvent: deleteCommentInEvent,
		getEventById: getEventById,
	};
})(window);
