import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, ImageBackground } from "react-native";
import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer, persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";

/* ========================= Types & Constantes ========================= */

type Mode = "semaine" | "weekend";
type SettingsState = {
	mode: Mode | null;
	times: { semaine: string; weekend: string }; // format "HH:mm"
	weekendEnabled: boolean;
};

const DEFAULTS: SettingsState = {
	mode: null,
	times: { semaine: "06:30", weekend: "10:00" },
	weekendEnabled: true,
};

const STORAGE_KEY = "temps_de_someil_restant";

/* ============================== Helpers ============================== */

const isWeekend = (d = new Date()) => [0, 6].includes(d.getDay());
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const two = (n: number) => String(n).padStart(2, "0");
const splitHHMM = (s: string) => {
	const [hh = "00", mm = "00"] = (s || "").split(":");
	return { hh, mm };
};
const joinHHMM = (hh: string, mm: string) => `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;

const computeRemaining = (hh: number, mm: number, now = new Date()) => {
	const wake = new Date(now);
	wake.setHours(hh, mm, 0, 0);
	if (wake <= now) wake.setDate(wake.getDate() + 1);
	const diffMin = Math.round((wake.getTime() - now.getTime()) / 60000);
	const h = Math.floor(diffMin / 60);
	const m = diffMin % 60;
	return { h, m, total: h + m / 60 };
};

const colorFromTotal = (t: number) => (t >= 8 ? styles.boxGood : t >= 6 ? styles.boxWarn : t >= 3 ? styles.boxBad : styles.boxVeryLow);

/* ============================ Redux Slice ============================ */

const settingsSlice = createSlice({
	name: "settings",
	initialState: DEFAULTS as SettingsState,
	reducers: {
		ensureModeInitialized(state) {
			if (state.mode === null) state.mode = isWeekend() ? "weekend" : "semaine";
		},
		setWeekendEnabled(state, action: PayloadAction<boolean>) {
			state.weekendEnabled = action.payload;
			if (!state.weekendEnabled) state.mode = "semaine";
		},
		setMode(state, action: PayloadAction<Mode>) {
			state.mode = action.payload;
		},
		setTime(state, action: PayloadAction<{ mode: Mode; value: string }>) {
			state.times[action.payload.mode] = action.payload.value;
			if (!state.weekendEnabled) {
				// sans séparation week‑end, on synchronise les deux
				state.times.semaine = action.payload.value;
				state.times.weekend = action.payload.value;
			}
		},
		resetAll() {
			return DEFAULTS;
		},
	},
});

const { actions, reducer: settingsReducer } = settingsSlice;

const persistConfig = {
	key: STORAGE_KEY,
	storage: AsyncStorage,
	whitelist: ["mode", "times", "weekendEnabled"],
};
const persistedReducer = persistReducer<SettingsState>(persistConfig, settingsReducer);

const store = configureStore({
	reducer: { settings: persistedReducer },
	middleware: (gDM) => gDM({ serializableCheck: false }),
});
const persistor = persistStore(store);

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

/* ============================== UI Bits ============================== */

const Segmented = ({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) => (
	<View style={styles.segmented}>
		{(["semaine", "weekend"] as Mode[]).map((m) => {
			const active = value === m;
			return (
				<TouchableOpacity key={m} style={[styles.segmentBtn, active ? styles.segmentBtnActive : styles.segmentBtnIdle]} onPress={() => onChange(m)}>
					<Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{m === "semaine" ? "Semaine" : "Week‑end"}</Text>
				</TouchableOpacity>
			);
		})}
	</View>
);

/* ============================ Écran principal ============================ */
/* Inputs HH / MM avec TextInput, nettoyage live + normalisation au blur   */
/* Un état local par input, et persistance via Redux‑Persist               */

const HomeScreen = () => {
	const dispatch = useDispatch<AppDispatch>();
	const { mode: storeMode, times, weekendEnabled: storeWeekend } = useSelector((s: RootState) => s.settings);

	// États locaux (1 par input) — méthode du cours
	const [weekendEnabled, setWeekendEnabled] = useState<boolean>(storeWeekend);
	const [mode, setMode] = useState<Mode>(storeMode ?? (isWeekend() ? "weekend" : "semaine"));
	const initSplit = splitHHMM(times[mode]);
	const [hour, setHour] = useState<string>(initSplit.hh);
	const [minute, setMinute] = useState<string>(initSplit.mm);

	// Init Redux (mode auto si besoin)
	useEffect(() => {
		dispatch(actions.ensureModeInitialized());
	}, [dispatch]);

	// Quand le mode change, on charge HH/MM correspondants
	useEffect(() => {
		const { hh, mm } = splitHHMM(times[mode]);
		setHour(hh);
		setMinute(mm);
	}, [mode, times.semaine, times.weekend]);

	// Propagation des changements “switch” & “mode” vers Redux
	useEffect(() => {
		if (storeWeekend !== weekendEnabled) dispatch(actions.setWeekendEnabled(weekendEnabled));
	}, [weekendEnabled, storeWeekend, dispatch]);

	useEffect(() => {
		if (storeMode !== mode) dispatch(actions.setMode(mode));
	}, [mode, storeMode, dispatch]);

	// Nettoyage live (comme l’autre projet)
	const onChangeHour = (v: string) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setHour(clean);
		// On persiste au fil de la saisie
		dispatch(actions.setTime({ mode, value: joinHHMM(clean, minute) }));
	};
	const onChangeMinute = (v: string) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setMinute(clean);
		dispatch(actions.setTime({ mode, value: joinHHMM(hour, clean) }));
	};

	// Normalisation au blur (clamp + padding)
	const normalizeHour = () => {
		const n = clamp(parseInt(hour || "0", 10) || 0, 0, 23);
		const padded = two(n);
		setHour(padded);
		dispatch(actions.setTime({ mode, value: joinHHMM(padded, minute) }));
	};
	const normalizeMinute = () => {
		const n = clamp(parseInt(minute || "0", 10) || 0, 0, 59);
		const padded = two(n);
		setMinute(padded);
		dispatch(actions.setTime({ mode, value: joinHHMM(hour, padded) }));
	};

	// Si week‑end désactivé, on force le mode “semaine”
	useEffect(() => {
		if (!weekendEnabled && mode !== "semaine") setMode("semaine");
	}, [weekendEnabled, mode]);

	// Rendu du compte à rebours — on recalcule chaque minute
	const [tick, setTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 60_000);
		return () => clearInterval(id);
	}, []);
	const remain = useMemo(() => {
		const hh = clamp(parseInt(hour || "0", 10) || 0, 0, 23);
		const mm = clamp(parseInt(minute || "0", 10) || 0, 0, 59);
		return computeRemaining(hh, mm);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hour, minute, tick]);

	const colorStyle = colorFromTotal(remain.total);

	return (
		<ImageBackground source={require("./assets/nuages_1.jpg")} style={styles.bg} resizeMode="cover">
			<SafeAreaView style={styles.container}>
				<View style={styles.card}>
					{/* Switch Week‑end */}
					<View style={styles.row}>
						<Text style={styles.title}>Afficher un horaire distinct week‑end</Text>
						<Switch value={weekendEnabled} onValueChange={setWeekendEnabled} />
					</View>

					{/* Onglets */}
					{weekendEnabled && (
						<View style={{ marginBottom: 8 }}>
							<Segmented value={mode} onChange={setMode} />
						</View>
					)}

					{/* Entrée HH:MM (méthode “deux TextInput”) */}
					<View style={styles.centerInputs}>
						<Text style={styles.label}>Heure de réveil :</Text>
						<View style={styles.timeRow}>
							<TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={hour} onChangeText={onChangeHour} onBlur={normalizeHour} placeholder="HH" textAlign="center" />
							<Text style={styles.colon}>:</Text>
							<TextInput
								style={styles.input}
								keyboardType="numeric"
								maxLength={2}
								value={minute}
								onChangeText={onChangeMinute}
								onBlur={normalizeMinute}
								placeholder="MM"
								textAlign="center"
							/>
						</View>
					</View>
					{/* Affichage temps restant */}
					<View style={[styles.sleepBox, colorStyle]}>
						<Text style={styles.sleepText}>
							{two(remain.h)}:{two(remain.m)}
						</Text>
					</View>
				</View>
			</SafeAreaView>
		</ImageBackground>
	);
};

/* ============================= Bootstrap ============================= */

export default function App() {
	return (
		<Provider store={store}>
			<PersistGate persistor={persistor} loading={null}>
				<HomeScreen />
			</PersistGate>
		</Provider>
	);
}

/* =============================== Store =============================== */

const stylesReducer = (state = {}) => state; // placeholder si besoin d’autres reducers

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
	},
	card: {
		width: "100%",
		maxWidth: 460,
		minHeight: 420, // ajoute cette ligne
		// // backgroundColor: "rgba(255,255,255,0.9)",
		// borderRadius: 14,
		// padding: 16,
		// borderWidth: StyleSheet.hairlineWidth,
		// // borderColor: "rgba(0,0,0,0.08)",
		// // shadowColor: "#000",
		// shadowOpacity: 0.12,
		// shadowRadius: 10,
		// shadowOffset: { width: 0, height: 6 },
		// elevation: 4,
	},
	row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	title: { fontSize: 16, fontWeight: "600" },
	label: { fontSize: 16, marginTop: 8, marginBottom: 6 },
	timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
	input: {
		width: 64,
		height: 56,
		fontSize: 22,
		borderWidth: 1,
		borderColor: "#c8d3e8",
		borderRadius: 8,
		backgroundColor: "#fff",
	},
	colon: { fontSize: 22, fontWeight: "700", marginHorizontal: 8 },
	segmented: { flexDirection: "row", backgroundColor: "#eef3ff", borderRadius: 10, padding: 4 },
	segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
	segmentBtnActive: { backgroundColor: "#0d6efd" },
	segmentBtnIdle: { backgroundColor: "transparent" },
	segmentLabel: { fontWeight: "600", color: "#0d6efd" },
	segmentLabelActive: { color: "#fff" },
	sleepBox: {
		alignSelf: "center",
		width: 220,
		height: 220,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	sleepText: { fontSize: 42, fontWeight: "800", color: "#fff", letterSpacing: 1 },
	boxGood: { backgroundColor: "#198754" },
	boxWarn: { backgroundColor: "#ffc107" },
	boxBad: { backgroundColor: "#dc3545" },
	boxVeryLow: { backgroundColor: "#0d0d0d" },
	bg: { flex: 1, justifyContent: "center", alignItems: "center" },
	centerInputs: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 12, // ajuste pour l'espacement souhaité
	},
});

/* =========================== Store bootstrap ========================== */
// (placé en bas pour garder un seul fichier)
function makeStore() {
	return store;
}
