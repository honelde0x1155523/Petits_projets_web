(function (window) {
	"use strict";
	var Modele = window.CalendrierModele;

	window.initCalendrier = function initCalendrier(opts) {
		if (!opts || !opts.mount) throw new Error("initCalendrier: {mount} requis.");

		var state = Modele.loadAll();
		if (!state.currentProfileKey || !Object.keys(state.profils).length) {
			Modele.createProfile(state);
		}
		Modele.saveAll(state);

		var view = window.CalendrierView.createUI({ mount: opts.mount });

		var ctx = (function () {
			var t = new Date();
			return { y: t.getFullYear(), m: t.getMonth() };
		})();

		function refreshProfilesSelect() {
			var sel = view.profileSelect;
			sel.innerHTML = "";
			var keys = Object.keys(state.profils);
			for (var i = 0; i < keys.length; i++) {
				var k = keys[i],
					p = state.profils[k];
				var op = document.createElement("option");
				op.value = k;
				op.textContent = p.name || "Profil " + (i + 1);
				if (k === state.currentProfileKey) op.selected = true;
				sel.appendChild(op);
			}
		}
		function currentProfile() {
			return Modele.getCurrentProfile(state);
		}

		var formRefs = view.getForm();
		var formEl = opts.mount.querySelector("#cal-form");
		var deleteBtn = formEl ? formEl.querySelector("button.btn-outline-danger") : null;

		function selectedEventObj() {
			var key = state.currentProfileKey;
			var id = formRefs.id.value || null;
			if (!key || !id) return null;
			return Modele.getEventById(state, key, id);
		}

		function renderAll() {
			var p = currentProfile();
			if (!p) return;
			view.renderMonth({ y: ctx.y, m: ctx.m, profile: p });
			view.renderTasks(p, selectedEventObj());
			Modele.saveAll(state);
		}

		function setToday() {
			var t = new Date();
			ctx.y = t.getFullYear();
			ctx.m = t.getMonth();
			renderAll();
		}
		function pad2(n) {
			return (n < 10 ? "0" : "") + n;
		}

		/* Profils */
		refreshProfilesSelect();
		view.profileSelect.addEventListener("change", function () {
			Modele.setCurrentProfile(state, this.value);
			renderAll();
		});
		view.btnNewProfile.addEventListener("click", function () {
			Modele.createProfile(state);
			Modele.saveAll(state);
			refreshProfilesSelect();
			renderAll();
		});
		view.btnRenameProfile.addEventListener("click", function () {
			if (!state.currentProfileKey) return;
			var curr = currentProfile();
			var name = prompt("Nouveau nom du profil :", curr && curr.name ? curr.name : "");
			if (!name) return;
			Modele.renameProfile(state, state.currentProfileKey, String(name).trim());
			Modele.saveAll(state);
			refreshProfilesSelect();
			renderAll();
		});
		view.btnDeleteProfile.addEventListener("click", function () {
			if (!state.currentProfileKey) return;
			if (!confirm("Supprimer le profil courant ?")) return;
			Modele.deleteProfile(state, state.currentProfileKey);
			Modele.saveAll(state);
			refreshProfilesSelect();
			renderAll();
		});

		/* Navigation mois */
		view.btnPrev.addEventListener("click", function () {
			ctx.m -= 1;
			if (ctx.m < 0) {
				ctx.m = 11;
				ctx.y -= 1;
			}
			renderAll();
		});
		view.btnNext.addEventListener("click", function () {
			ctx.m += 1;
			if (ctx.m > 11) {
				ctx.m = 0;
				ctx.y += 1;
			}
			renderAll();
		});
		view.btnToday.addEventListener("click", setToday);

		/* CRUD évènements */
		if (formEl) {
			formEl.addEventListener("submit", function (e) {
				e.preventDefault();
				saveEvent();
			});
		}
		if (deleteBtn) {
			deleteBtn.addEventListener("click", function () {
				deleteEvent();
			});
		}

		// Réagir à la sélection d’un évènement depuis la vue
		opts.mount.addEventListener("cal:event-selected", function () {
			renderAll();
		});

		function parseFormToEvent(existingId) {
			var ymd = String(formRefs.date.value || "");
			if (!ymd) return null;
			var p = ymd.split("-");
			var y = +p[0],
				m = +p[1] - 1,
				d = +p[2];
			function hm(v, def) {
				v = v || def;
				return { h: +v.slice(0, 2), m: +v.slice(3, 5) };
			}
			var s = hm(formRefs.start.value, "09:00"),
				e = hm(formRefs.end.value, "10:00");
			var evt = {
				id: existingId || null,
				startISO: new Date(y, m, d, s.h, s.m, 0, 0).toISOString(),
				endISO: new Date(y, m, d, e.h, e.m, 0, 0).toISOString(),
				title: String(formRefs.title.value || ""),
				attendeesCsv: String(formRefs.people.value || ""),
				content: String(formRefs.content.value || ""),
				subtasks: [],
			};
			// si on modifie, préserver tasks existantes
			if (evt.id) {
				var cur = Modele.getEventById(state, state.currentProfileKey, evt.id);
				if (cur && Array.isArray(cur.tasks)) evt.tasks = cur.tasks;
			} else {
				evt.tasks = [];
			}
			return evt;
		}

		function saveEvent() {
			var key = state.currentProfileKey;
			if (!key) return;
			var isEdit = !!formRefs.id.value;
			var evt = parseFormToEvent(isEdit ? formRefs.id.value : null);
			if (!evt) return;

			if (isEdit) {
				evt.id = formRefs.id.value;
				Modele.updateEvent(state, key, evt);
			} else {
				Modele.addEvent(state, key, evt);
				formRefs.id.value = evt.id;
			}

			if (formRefs.subChk && formRefs.subChk.checked) {
				evt = Modele.expandIntoSubtasks(evt, formRefs.subN && formRefs.subN.value ? formRefs.subN.value : 3);
				Modele.updateEvent(state, key, evt);
			}

			var overlap = Modele.detectOverlap(currentProfile(), evt);
			if (overlap && confirm("Chevauchement détecté avec « " + (overlap.title || "(sans objet)") + " ». Proposer un déplacement automatique ?")) {
				var prop = Modele.proposeMove(currentProfile(), evt);
				if (prop) {
					evt.startISO = prop.startISO;
					evt.endISO = prop.endISO;
					Modele.updateEvent(state, key, evt);
					alert("Évènement déplacé.");
				}
			}

			Modele.saveAll(state);
			renderAll();
		}

		function deleteEvent() {
			var key = state.currentProfileKey;
			if (!key || !formRefs.id.value) return;
			if (!confirm("Supprimer cet évènement ?")) return;
			Modele.deleteEvent(state, key, formRefs.id.value);
			formRefs.id.value = "";
			Modele.saveAll(state);
			renderAll();
		}

		/* Tâches + commentaires (par évènement) */
		var tasksUI = view.tasksUI;

		tasksUI.addBtn.addEventListener("click", function () {
			var key = state.currentProfileKey,
				ev = selectedEventObj();
			if (!key || !ev) return;
			var title = (tasksUI.newInput.value || "").trim();
			Modele.addTaskToEvent(state, key, ev.id, title);
			tasksUI.newInput.value = "";
			Modele.saveAll(state);
			renderAll();
		});
		tasksUI.newInput.addEventListener("keydown", function (e) {
			if (e.key === "Enter") {
				e.preventDefault();
				tasksUI.addBtn.click();
			}
		});

		tasksUI.list.addEventListener("change", function (evn) {
			var trow = evn.target.closest("[data-task-id]");
			var key = state.currentProfileKey;
			var ev = selectedEventObj();
			if (!trow || !key || !ev) return;
			var taskId = trow.getAttribute("data-task-id");
			if (evn.target.classList.contains("cal-task-done")) {
				Modele.toggleTaskInEvent(state, key, ev.id, taskId, !!evn.target.checked);
				Modele.saveAll(state);
			} else if (evn.target.classList.contains("cal-task-title")) {
				Modele.updateTaskTitleInEvent(state, key, ev.id, taskId, evn.target.value);
				Modele.saveAll(state);
			}
		});
		tasksUI.list.addEventListener("input", function (evn) {
			var trow = evn.target.closest("[data-task-id]");
			var key = state.currentProfileKey;
			var ev = selectedEventObj();
			if (!trow || !key || !ev) return;
			var taskId = trow.getAttribute("data-task-id");
			if (evn.target.classList.contains("cal-task-title")) {
				Modele.updateTaskTitleInEvent(state, key, ev.id, taskId, evn.target.value);
				Modele.saveAll(state);
			}
		});
		tasksUI.list.addEventListener("click", function (evn) {
			var trow = evn.target.closest("[data-task-id]");
			var key = state.currentProfileKey;
			var ev = selectedEventObj();
			if (!trow || !key || !ev) return;
			var taskId = trow.getAttribute("data-task-id");

			if (evn.target.classList.contains("cal-task-del")) {
				if (confirm("Supprimer cette tâche ?")) {
					Modele.deleteTaskInEvent(state, key, ev.id, taskId);
					Modele.saveAll(state);
					renderAll();
				}
			}
			if (evn.target.classList.contains("cal-cmt-add")) {
				var input = trow.querySelector(".cal-cmt-text");
				var txt = input ? input.value.trim() : "";
				if (!txt) return;
				Modele.addCommentInEvent(state, key, ev.id, taskId, txt);
				Modele.saveAll(state);
				renderAll();
			}
			if (evn.target.classList.contains("cal-cmt-edit")) {
				var crow = evn.target.closest("[data-cmt-id]");
				if (!crow) return;
				var cmtId = crow.getAttribute("data-cmt-id");
				var old = crow.querySelector("div").innerText.split("\n")[0] || "";
				var neu = prompt("Modifier le commentaire :", old);
				if (neu == null) return;
				Modele.updateCommentInEvent(state, key, ev.id, taskId, cmtId, neu);
				Modele.saveAll(state);
				renderAll();
			}
			if (evn.target.classList.contains("cal-cmt-del")) {
				var crow2 = evn.target.closest("[data-cmt-id]");
				if (!crow2) return;
				var cmtId2 = crow2.getAttribute("data-cmt-id");
				if (confirm("Supprimer ce commentaire ?")) {
					Modele.deleteCommentInEvent(state, key, ev.id, cmtId2);
					Modele.saveAll(state);
					renderAll();
				}
			}
		});

		/* Premier rendu */
		refreshProfilesSelect();
		renderAll();
	};
})(window);
