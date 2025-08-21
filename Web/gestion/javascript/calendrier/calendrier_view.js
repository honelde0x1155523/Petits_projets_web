(function (window, document) {
	"use strict";
	function pad2(n) {
		return (n < 10 ? "0" : "") + n;
	}
	function formatTime(dt) {
		return pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
	}
	function weekdayNames() {
		return ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
	}
	function ucFirstFr(s) {
		return s ? s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1) : s;
	}
	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, function (m) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
		});
	}

	function createUI(opts) {
		if (!opts || !opts.mount) throw new Error("CalendrierView.createUI: {mount} requis.");
		var mount = opts.mount;
		mount.innerHTML = "";

		/* Barre profils */
		var bar = document.createElement("div");
		bar.className = "d-flex align-items-end flex-wrap gap-3 mb-3";
		var profGroup = document.createElement("div");
		profGroup.className = "d-flex align-items-end gap-2";
		var labP = document.createElement("label");
		labP.className = "form-label small mb-0";
		labP.textContent = "Profil";
		var selP = document.createElement("select");
		selP.className = "form-select";
		selP.style.minWidth = "280px";
		var btnNewP = document.createElement("button");
		btnNewP.className = "btn btn-outline-primary";
		btnNewP.type = "button";
		btnNewP.textContent = "Nouveau profil +";
		var btnRenP = document.createElement("button");
		btnRenP.className = "btn btn-outline-secondary";
		btnRenP.type = "button";
		btnRenP.textContent = "Renommer";
		var btnDelP = document.createElement("button");
		btnDelP.className = "btn btn-outline-danger";
		btnDelP.type = "button";
		btnDelP.textContent = "Supprimer le profil";
		profGroup.appendChild(labP);
		profGroup.appendChild(selP);
		profGroup.appendChild(btnNewP);
		profGroup.appendChild(btnRenP);
		profGroup.appendChild(btnDelP);

		/* Nav mois */
		var nav = document.createElement("div");
		nav.className = "d-flex align-items-center gap-2 ms-auto";
		var btnPrev = document.createElement("button");
		btnPrev.className = "btn btn-outline-secondary";
		btnPrev.type = "button";
		btnPrev.textContent = "‹";
		var title = document.createElement("h5");
		title.className = "mb-0";
		var btnNext = document.createElement("button");
		btnNext.className = "btn btn-outline-secondary";
		btnNext.type = "button";
		btnNext.textContent = "›";
		var btnToday = document.createElement("button");
		btnToday.className = "btn btn-outline-secondary";
		btnToday.type = "button";
		btnToday.textContent = "Aujourd’hui";
		nav.appendChild(btnPrev);
		nav.appendChild(title);
		nav.appendChild(btnNext);
		nav.appendChild(btnToday);

		bar.appendChild(profGroup);
		bar.appendChild(nav);
		mount.appendChild(bar);

		/* Grille + colonne droite */
		var row = document.createElement("div");
		row.className = "row g-3";

		// Grille calendrier
		var colGrid = document.createElement("div");
		colGrid.className = "col-lg-8";
		var gridCard = document.createElement("div");
		gridCard.className = "card";
		var gridHead = document.createElement("div");
		gridHead.className = "card-header";
		gridHead.textContent = "Calendrier (mois)";
		var gridBody = document.createElement("div");
		gridBody.className = "card-body p-0";
		var table = document.createElement("table");
		table.className = "table table-sm mb-0 align-middle table-fixed";
		var thead = document.createElement("thead");
		thead.className = "table-light";
		var trh = document.createElement("tr");
		var wdays = weekdayNames();
		for (var i = 0; i < wdays.length; i++) {
			var th = document.createElement("th");
			th.textContent = wdays[i];
			trh.appendChild(th);
		}
		thead.appendChild(trh);
		var tbody = document.createElement("tbody");
		table.appendChild(thead);
		table.appendChild(tbody);
		gridBody.appendChild(table);
		gridCard.appendChild(gridHead);
		gridCard.appendChild(gridBody);
		colGrid.appendChild(gridCard);

		// Colonne droite
		var colRight = document.createElement("div");
		colRight.className = "col-lg-4";

		// Carte Évènement
		var editCard = document.createElement("div");
		editCard.className = "card";
		var editHead = document.createElement("div");
		editHead.className = "card-header";
		editHead.textContent = "Évènement";
		var editBody = document.createElement("div");
		editBody.className = "card-body";
		var form = document.createElement("form");
		form.id = "cal-form";

		function input(label, type) {
			var g = document.createElement("div");
			g.className = "mb-2";
			var l = document.createElement("label");
			l.className = "form-label";
			l.textContent = label;
			var i = document.createElement("input");
			i.type = type || "text";
			i.className = "form-control";
			g.appendChild(l);
			g.appendChild(i);
			return { group: g, input: i };
		}
		function textarea(label) {
			var g = document.createElement("div");
			g.className = "mb-2";
			var l = document.createElement("label");
			l.className = "form-label";
			l.textContent = label;
			var t = document.createElement("textarea");
			t.className = "form-control";
			t.rows = 3;
			g.appendChild(l);
			g.appendChild(t);
			return { group: g, input: t };
		}

		var fDate = input("Date", "date"),
			fStart = input("Début (HH:MM)", "time"),
			fEnd = input("Fin (HH:MM)", "time");
		var fTitle = input("Objet", "text"),
			fPeople = textarea("Personnes présentes (séparées par des virgules)"),
			fContent = textarea("Contenu / Notes");
		var fSubWrap = document.createElement("div");
		fSubWrap.className = "mb-2";
		var fSubChk = document.createElement("input");
		fSubChk.type = "checkbox";
		fSubChk.className = "form-check-input me-2";
		var fSubLab = document.createElement("label");
		fSubLab.className = "form-check-label me-2";
		fSubLab.textContent = "Créer des sous-tâches";
		var fSubN = document.createElement("input");
		fSubN.type = "number";
		fSubN.min = "1";
		fSubN.value = "3";
		fSubN.className = "form-control d-inline-block";
		fSubN.style.width = "90px";
		fSubWrap.appendChild(fSubChk);
		fSubWrap.appendChild(fSubLab);
		fSubWrap.appendChild(fSubN);

		var fHiddenId = document.createElement("input");
		fHiddenId.type = "hidden";
		var btnRow = document.createElement("div");
		btnRow.className = "d-flex gap-2 mt-2";
		var btnSave = document.createElement("button");
		btnSave.type = "submit";
		btnSave.className = "btn btn-primary";
		btnSave.textContent = "Enregistrer";
		var btnDelete = document.createElement("button");
		btnDelete.type = "button";
		btnDelete.className = "btn btn-outline-danger ms-auto";
		btnDelete.textContent = "Supprimer";

		form.appendChild(fDate.group);
		form.appendChild(fStart.group);
		form.appendChild(fEnd.group);
		form.appendChild(fTitle.group);
		form.appendChild(fPeople.group);
		form.appendChild(fContent.group);
		form.appendChild(fSubWrap);
		form.appendChild(fHiddenId);
		btnRow.appendChild(btnSave);
		btnRow.appendChild(btnDelete);
		form.appendChild(btnRow);
		editBody.appendChild(form);
		editCard.appendChild(editHead);
		editCard.appendChild(editBody);

		// Carte Tâches (liées à l'évènement sélectionné)
		var taskCard = document.createElement("div");
		taskCard.className = "card mt-3";
		var taskHead = document.createElement("div");
		taskHead.className = "card-header";
		taskHead.textContent = "Tâches (de l’évènement)";
		var taskBody = document.createElement("div");
		taskBody.className = "card-body";
		var hint = document.createElement("p");
		hint.className = "text-muted small mb-2";
		hint.textContent = "Sélectionnez ou enregistrez un évènement pour gérer ses tâches.";
		var newRow = document.createElement("div");
		newRow.className = "input-group mb-2";
		var inpNewTask = document.createElement("input");
		inpNewTask.type = "text";
		inpNewTask.className = "form-control";
		inpNewTask.placeholder = "Nouvelle tâche…";
		var btnAddTask = document.createElement("button");
		btnAddTask.className = "btn btn-outline-primary";
		btnAddTask.type = "button";
		btnAddTask.textContent = "Ajouter";
		newRow.appendChild(inpNewTask);
		newRow.appendChild(btnAddTask);
		var taskList = document.createElement("div");
		taskList.id = "cal-task-list";
		taskList.className = "d-flex flex-column gap-2";
		taskBody.appendChild(hint);
		taskBody.appendChild(newRow);
		taskBody.appendChild(taskList);
		taskCard.appendChild(taskHead);
		taskCard.appendChild(taskBody);

		colRight.appendChild(editCard);
		colRight.appendChild(taskCard);
		row.appendChild(colGrid);
		row.appendChild(colRight);
		mount.appendChild(row);

		function renderMonth(ctx) {
			var label = new Date(ctx.y, ctx.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
			title.textContent = ucFirstFr(label);

			tbody.innerHTML = "";
			var first = new Date(ctx.y, ctx.m, 1);
			var jsDay = first.getDay();
			if (jsDay === 0) jsDay = 7;
			var leading = jsDay - 1;
			var days = new Date(ctx.y, ctx.m + 1, 0).getDate();
			var cells = leading + days,
				rows = Math.ceil(cells / 7);
			var d = 1;
			for (var r = 0; r < rows; r++) {
				var tr = document.createElement("tr");
				for (var c = 0; c < 7; c++) {
					var td = document.createElement("td");
					td.style.verticalAlign = "top";
					td.className = "align-top";
					if (r === 0 && c < leading) {
						td.innerHTML = "&nbsp;";
					} else if (d <= days) {
						(function (day) {
							var head = document.createElement("div");
							head.className = "d-flex justify-content-between align-items-start";
							var strong = document.createElement("strong");
							strong.textContent = String(day);
							var btnAdd = document.createElement("button");
							btnAdd.type = "button";
							btnAdd.className = "btn btn-sm btn-outline-primary";
							btnAdd.textContent = "+";
							head.appendChild(strong);
							head.appendChild(btnAdd);
							td.appendChild(head);

							var list = document.createElement("div");
							list.className = "mt-1 d-flex flex-column gap-1";
							var items = window.CalendrierModele.listEventsOnDay(ctx.profile, ctx.y, ctx.m, day);
							for (var i2 = 0; i2 < items.length; i2++) {
								var e = items[i2],
									sdt = new Date(e.startISO),
									edt = new Date(e.endISO);
								var b = document.createElement("button");
								b.type = "button";
								b.className = "btn btn-sm btn-light text-start";
								b.setAttribute("data-id", e.id);
								b.innerHTML = '<span class="badge text-bg-secondary me-1">' + formatTime(sdt) + "-" + formatTime(edt) + "</span>" + escapeHtml(e.title || "(sans objet)");
								list.appendChild(b);
							}
							td.appendChild(list);

							btnAdd.addEventListener("click", function () {
								var base = new Date(ctx.y, ctx.m, day);
								var iso = base.toISOString().slice(0, 10);
								fHiddenId.value = ""; // pas d’évènement encore
								fDate.input.value = iso;
								fStart.input.value = "09:00";
								fEnd.input.value = "10:00";
								fTitle.input.value = "";
								fPeople.input.value = "";
								fContent.input.value = "";
								mount.dispatchEvent(new CustomEvent("cal:event-selected")); // rafraîchir panel tâches (désactivé)
							});
							list.addEventListener("click", function (ev) {
								var b = ev.target.closest("button[data-id]");
								if (!b) return;
								var id = b.getAttribute("data-id");
								var evts = ctx.profile.events;
								for (var j = 0; j < evts.length; j++)
									if (evts[j].id === id) {
										var e2 = evts[j],
											s = new Date(e2.startISO),
											en = new Date(e2.endISO);
										fHiddenId.value = e2.id;
										fDate.input.value = e2.startISO.slice(0, 10);
										fStart.input.value = pad2(s.getHours()) + ":" + pad2(s.getMinutes());
										fEnd.input.value = pad2(en.getHours()) + ":" + pad2(en.getMinutes());
										fTitle.input.value = e2.title || "";
										fPeople.input.value = e2.attendeesCsv || "";
										fContent.input.value = e2.content || "";
										mount.dispatchEvent(new CustomEvent("cal:event-selected")); // rafraîchir panel tâches (lié à cet évènement)
										break;
									}
							});
						})(d);
						d++;
					} else {
						td.innerHTML = "&nbsp;";
					}
					tr.appendChild(td);
				}
				tbody.appendChild(tr);
			}
		}

		function renderTasks(profile, eventObj) {
			// État disabled si pas d’évènement sélectionné
			var hasEvent = !!(eventObj && eventObj.id);
			inpNewTask.disabled = !hasEvent;
			btnAddTask.disabled = !hasEvent;
			taskList.innerHTML = "";
			if (!hasEvent) return;

			for (var i = 0; i < (eventObj.tasks || []).length; i++) {
				var t = eventObj.tasks[i];

				var row = document.createElement("div");
				row.className = "border rounded p-2";
				row.setAttribute("data-task-id", t.id);

				var top = document.createElement("div");
				top.className = "d-flex align-items-center gap-2";
				var chk = document.createElement("input");
				chk.type = "checkbox";
				chk.className = "form-check-input cal-task-done";
				chk.checked = !!t.done;
				var titleInp = document.createElement("input");
				titleInp.type = "text";
				titleInp.className = "form-control form-control-sm cal-task-title";
				titleInp.value = t.title;
				var btnDel = document.createElement("button");
				btnDel.type = "button";
				btnDel.className = "btn btn-sm btn-outline-danger cal-task-del ms-auto";
				btnDel.textContent = "Supprimer";
				top.appendChild(chk);
				top.appendChild(titleInp);
				top.appendChild(btnDel);

				var cWrap = document.createElement("div");
				cWrap.className = "mt-2";
				var cTitle = document.createElement("div");
				cTitle.className = "fw-semibold mb-1";
				cTitle.textContent = "Commentaires";
				var cList = document.createElement("div");
				cList.className = "d-flex flex-column gap-1";

				for (var j = 0; j < (t.comments || []).length; j++) {
					var c = t.comments[j];
					var line = document.createElement("div");
					line.className = "d-flex align-items-start gap-2";
					line.setAttribute("data-cmt-id", c.id);
					var txt = document.createElement("div");
					txt.className = "flex-grow-1";
					var meta = new Date(c.createdISO).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
					var upd = c.updatedISO
						? " (modifié " + new Date(c.updatedISO).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) + ")"
						: "";
					txt.innerHTML = "<div>" + escapeHtml(c.text) + '</div><small class="text-muted">' + meta + upd + "</small>";
					var btnEdit = document.createElement("button");
					btnEdit.type = "button";
					btnEdit.className = "btn btn-sm btn-outline-secondary cal-cmt-edit";
					btnEdit.textContent = "Modifier";
					var btnDelC = document.createElement("button");
					btnDelC.type = "button";
					btnDelC.className = "btn btn-sm btn-outline-danger cal-cmt-del";
					btnDelC.textContent = "Supprimer";
					line.appendChild(txt);
					line.appendChild(btnEdit);
					line.appendChild(btnDelC);
					cList.appendChild(line);
				}

				var addRow = document.createElement("div");
				addRow.className = "input-group input-group-sm mt-1";
				var inp = document.createElement("input");
				inp.type = "text";
				inp.className = "form-control cal-cmt-text";
				inp.placeholder = "Nouveau commentaire…";
				var btnAdd = document.createElement("button");
				btnAdd.className = "btn btn-outline-primary cal-cmt-add";
				btnAdd.type = "button";
				btnAdd.textContent = "Ajouter";
				addRow.appendChild(inp);
				addRow.appendChild(btnAdd);

				cWrap.appendChild(cTitle);
				cWrap.appendChild(cList);
				cWrap.appendChild(addRow);

				row.appendChild(top);
				row.appendChild(cWrap);
				taskList.appendChild(row);
			}
		}

		return {
			mount: mount,
			profileSelect: selP,
			btnNewProfile: btnNewP,
			btnRenameProfile: btnRenP,
			btnDeleteProfile: btnDelP,
			btnPrev: btnPrev,
			btnNext: btnNext,
			btnToday: btnToday,
			renderMonth: renderMonth,
			renderTasks: renderTasks,
			getForm: function () {
				return {
					id: (function () {
						return fHiddenId;
					})(),
					date: fDate.input,
					start: fStart.input,
					end: fEnd.input,
					title: fTitle.input,
					people: fPeople.input,
					content: fContent.input,
					subChk: fSubChk,
					subN: fSubN,
				};
			},
			tasksUI: { list: taskList, addBtn: btnAddTask, newInput: inpNewTask },
			notify: {
				eventSelectedOnMount: function () {
					mount.dispatchEvent(new CustomEvent("cal:event-selected"));
				},
			},
		};
	}

	window.CalendrierView = { createUI: createUI };
})(window, document);
