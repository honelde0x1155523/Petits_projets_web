/* GestionUIJS.js — micro-outillage UI (ES5, 2014) */
(function (window, document) {
	"use strict";

	var GestionUI = {};

	/* ============ utilitaires DOM ============ */
	function el(tag, attrs) {
		var node = document.createElement(tag);
		if (attrs)
			for (var k in attrs)
				if (attrs.hasOwnProperty(k)) {
					if (k === "class") node.className = attrs[k];
					else if (k === "text") node.textContent = attrs[k];
					else node.setAttribute(k, attrs[k]);
				}
		return node;
	}
	function empty(node) {
		while (node.firstChild) node.removeChild(node.firstChild);
	}
	function on(node, evt, fn) {
		node.addEventListener(evt, fn);
	}
	function setAttrs(node, attrs) {
		for (var k in attrs)
			if (attrs.hasOwnProperty(k)) {
				if (k === "class") node.className = attrs[k];
				else node.setAttribute(k, attrs[k]);
			}
	}

	/* ============ alert badge ============ */
	GestionUI.alert = function (container, flavor, text) {
		container.innerHTML = '<span class="badge text-bg-' + flavor + '">' + escapeHtml(text) + "</span>";
	};

	/* ============ éditeur de liste (cartes) ============ */
	// options: { title, addLabel, fields: [{key,label,type,min,max}], checks:[{key,label,exclusiveWith}], initial:[], idKey }
	GestionUI.listEditor = function (mount, options) {
		var idKey = options.idKey || "id";
		var seq = 0;
		var items = [];
		var root = el("div");

		var list = el("div", { class: "d-flex flex-wrap gap-3 mb-3" });
		var addBtn = el("button", { class: "btn btn-outline-primary mb-3", type: "button" });
		addBtn.textContent = options.addLabel || "Ajouter";
		on(addBtn, "click", function () {
			addItem();
		});

		root.appendChild(addBtn);
		root.appendChild(list);
		mount.appendChild(root);

		function addItem(preset) {
			var data = {};
			for (var i = 0; i < options.fields.length; i++) {
				var f = options.fields[i];
				data[f.key] = typeof f.value === "number" || typeof f.value === "string" ? f.value : "";
			}
			if (options.checks) {
				for (var c = 0; c < options.checks.length; c++) {
					data[options.checks[c].key] = false;
				}
			}
			if (preset) for (var k in preset) if (preset.hasOwnProperty(k)) data[k] = preset[k];

			data[idKey] = ++seq;

			var card = el("div", { class: "card card-elevator", "data-id": String(data[idKey]) });
			var header = el("div", { class: "card-header d-flex justify-content-between align-items-center" });
			header.appendChild(el("strong", { text: (options.title || "Item") + " #" + data[idKey] }));
			var del = el("button", { class: "btn btn-sm btn-outline-danger", type: "button" });
			del.textContent = "Supprimer";
			on(del, "click", function () {
				list.removeChild(card);
				for (var i = items.length - 1; i >= 0; i--) if (items[i][idKey] === data[idKey]) items.splice(i, 1);
			});
			header.appendChild(del);

			var body = el("div", { class: "card-body" });
			var row = el("div", { class: "row g-3" });

			// champs
			for (var i2 = 0; i2 < options.fields.length; i2++) {
				var f2 = options.fields[i2];
				var col = el("div", { class: "col-4" });
				var lab = el("label", { class: "form-label", text: f2.label });
				var inp = el("input", { class: "form-control", "data-key": f2.key, type: f2.type || "text" });
				if (typeof f2.min !== "undefined") inp.setAttribute("min", f2.min);
				if (typeof f2.max !== "undefined") inp.setAttribute("max", f2.max);
				inp.value = data[f2.key];
				on(inp, "change", syncData);
				col.appendChild(lab);
				col.appendChild(inp);
				row.appendChild(col);
			}
			body.appendChild(row);

			// checks
			if (options.checks && options.checks.length) {
				var row2 = el("div", { class: "row mt-2" });
				var colc = el("div", { class: "col-12" });
				for (var j = 0; j < options.checks.length; j++) {
					var ck = options.checks[j];
					var wrap = el("div", { class: "form-check form-check-inline" });
					var inpCk = el("input", { class: "form-check-input", type: "checkbox", "data-ck": ck.key, id: ck.key + "-" + data[idKey] });
					var labCk = el("label", { class: "form-check-label" });
					labCk.setAttribute("for", ck.key + "-" + data[idKey]);
					labCk.textContent = ck.label;
					on(
						inpCk,
						"change",
						(function (ckLocal) {
							return function () {
								data[ckLocal.key] = !!this.checked;
								// exclusivité
								if (ckLocal.exclusiveWith && this.checked) {
									var other = card.querySelector('input[data-ck="' + ckLocal.exclusiveWith + '"]');
									if (other) {
										other.checked = false;
										data[ckLocal.exclusiveWith] = false;
									}
								}
							};
						})(ck)
					);
					wrap.appendChild(inpCk);
					wrap.appendChild(labCk);
					colc.appendChild(wrap);
				}
				row2.appendChild(colc);
				body.appendChild(row2);
			}

			card.appendChild(header);
			card.appendChild(body);
			list.appendChild(card);

			items.push(data);
			return data;

			function syncData() {
				var inputs = card.querySelectorAll("input[data-key]");
				for (var ii = 0; ii < inputs.length; ii++) {
					var k2 = inputs[ii].getAttribute("data-key");
					var type = inputs[ii].getAttribute("type");
					var v = inputs[ii].value;
					if (type === "number") data[k2] = Math.floor(Number(v) || 0);
					else data[k2] = v;
				}
			}
		}

		// init
		if (options.initial && options.initial.length) {
			for (var z = 0; z < options.initial.length; z++) addItem(options.initial[z]);
		}

		return {
			add: addItem,
			getData: function () {
				// relire les champs courants
				var cards = list.querySelectorAll(".card-elevator");
				for (var c = 0; c < cards.length; c++) {
					var id = parseInt(cards[c].getAttribute("data-id"), 10);
					var inputs = cards[c].querySelectorAll("input[data-key]");
					for (var ii = 0; ii < inputs.length; ii++) {
						var key = inputs[ii].getAttribute("data-key");
						var type = inputs[ii].getAttribute("type");
						var v = inputs[ii].value;
						for (var it = 0; it < items.length; it++)
							if (items[it][idKey] === id) {
								items[it][key] = type === "number" ? Math.floor(Number(v) || 0) : v;
							}
					}
					// checks
					var cks = cards[c].querySelectorAll("input[data-ck]");
					for (var jj = 0; jj < cks.length; jj++) {
						var kck = cks[jj].getAttribute("data-ck");
						for (var it2 = 0; it2 < items.length; it2++) if (items[it2][idKey] === id) items[it2][kck] = !!cks[jj].checked;
					}
				}
				return items.slice(0);
			},
			setMaxFor: function (key, maxVal) {
				var inputs = list.querySelectorAll('input[data-key="' + key + '"]');
				for (var i3 = 0; i3 < inputs.length; i3++) inputs[i3].setAttribute("max", maxVal);
			},
		};
	};

	/* ============ éditeur de tableau (lignes simples) ============ */
	// config: { rowLabel, columns:[{key,label,type,min,max}], initialRows, randomizeRow(fn)->row }
	GestionUI.tableEditor = function (mount, config) {
		var wrapper = el("div", { class: "card mb-3" });
		var head = el("div", { class: "card-header" });
		head.textContent = config.title || "Table";
		var body = el("div", { class: "card-body p-0" });
		var table = el("table", { class: "table table-sm mb-0 align-middle table-fixed" });
		var thead = el("thead", { class: "table-light" });
		var trh = el("tr");
		trh.appendChild(el("th", { style: "width:90px;", text: config.rowLabel || "Ligne" }));
		for (var c = 0; c < config.columns.length; c++) trh.appendChild(el("th", { text: config.columns[c].label }));
		thead.appendChild(trh);
		var tbody = el("tbody");

		table.appendChild(thead);
		table.appendChild(tbody);
		body.appendChild(el("div", { class: "table-responsive" })).appendChild(table);
		wrapper.appendChild(head);
		wrapper.appendChild(body);
		mount.appendChild(wrapper);

		function setRowCount(n) {
			n = Math.max(1, Math.floor(n || 1));
			empty(tbody);
			for (var i = 1; i <= n; i++) {
				var tr = el("tr");
				tr.appendChild(el("td", { class: "smallcaps", text: (config.rowLabel || "Ligne") + " " + i }));
				for (var j = 0; j < config.columns.length; j++) {
					var col = config.columns[j];
					var td = el("td");
					var inp = el("input", { class: "form-control form-control-sm", "data-col": col.key, type: col.type || "text" });
					if (typeof col.min !== "undefined") inp.setAttribute("min", col.min);
					if (typeof col.max !== "undefined") inp.setAttribute("max", col.max);
					// valeur par défaut
					if (config.randomizeRow && col.defaultRandom) {
						inp.value = config.randomizeRow(col);
					} else if (typeof col.value !== "undefined") {
						inp.value = col.value;
					}
					td.appendChild(inp);
					tr.appendChild(td);
				}
				tbody.appendChild(tr);
			}
		}

		function getData() {
			var rows = tbody.querySelectorAll("tr");
			var out = [];
			for (var r = 0; r < rows.length; r++) {
				var obj = { id: r + 1 };
				var inputs = rows[r].querySelectorAll("input[data-col]");
				for (var i = 0; i < inputs.length; i++) {
					var k = inputs[i].getAttribute("data-col");
					var type = inputs[i].getAttribute("type");
					var v = inputs[i].value;
					obj[k] = type === "number" ? Math.floor(Number(v) || 0) : v;
				}
				out.push(obj);
			}
			return out;
		}

		function setMaxFor(colKey, maxVal) {
			var inputs = tbody.querySelectorAll('input[data-col="' + colKey + '"]');
			for (var i = 0; i < inputs.length; i++) inputs[i].setAttribute("max", maxVal);
		}

		function rerollRandoms() {
			if (!config.randomizeRow) return;
			var rows = tbody.querySelectorAll("tr");
			for (var r = 0; r < rows.length; r++) {
				var inputs = rows[r].querySelectorAll("input[data-col]");
				for (var i = 0; i < inputs.length; i++) {
					var k = inputs[i].getAttribute("data-col");
					// seuls les colonnes avec defaultRandom = true
					for (var j = 0; j < config.columns.length; j++)
						if (config.columns[j].key === k && config.columns[j].defaultRandom) {
							inputs[i].value = config.randomizeRow(config.columns[j]);
						}
				}
			}
		}

		// init
		setRowCount(config.initialRows || 1);

		return {
			setRowCount: setRowCount,
			getData: getData,
			setMaxFor: setMaxFor,
			rerollRandoms: rerollRandoms,
		};
	};

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, function (m) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
		});
	}

	window.GestionUI = GestionUI;
})(window, document);
