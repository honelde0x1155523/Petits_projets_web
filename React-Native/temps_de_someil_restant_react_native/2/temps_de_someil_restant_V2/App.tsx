import React, { useEffect, useMemo, useState, useCallback } from "react";
import { SafeAreaView, View, Text, TextInput, Switch, StyleSheet, ImageBackground, TouchableOpacity, Pressable } from "react-native";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer, persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

/* ========================= Types & Constantes ========================= */
const DEFAULTS = {
	mode: null,
	times: { semaine: "06:30", weekend: "10:00" },
	weekendEnabled: true,
};
const STORAGE_KEY = "temps_de_someil_restant";

/* ============================== Helpers ============================== */
const isWeekend = (d = new Date()) => [0, 6].includes(d.getDay());
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const two = (n) => String(n).padStart(2, "0");
const splitHHMM = (s) => {
	const [hh = "00", mm = "00"] = (s || "").split(":");
	return { hh, mm };
};
const computeRemaining = (hh, mm, now = new Date()) => {
	const wake = new Date(now);
	wake.setHours(hh, mm, 0, 0);
	if (wake <= now) wake.setDate(wake.getDate() + 1);
	const diffMin = Math.round((wake - now) / 60000);
	return { h: Math.floor(diffMin / 60), m: diffMin % 60, total: diffMin / 60 };
};
const colorFromTotal = (t) => (t >= 8 ? styles.boxGood : t >= 6 ? styles.boxWarn : t >= 3 ? styles.boxBad : styles.boxVeryLow);

/* ============================ Redux Slice ============================ */
const settingsSlice = createSlice({
	name: "settings",
	initialState: DEFAULTS,
	reducers: {
		ensureModeInitialized(state) {
			if (state.mode === null) state.mode = isWeekend() ? "weekend" : "semaine";
		},
		setWeekendEnabled(state, action) {
			state.weekendEnabled = action.payload;
			if (!state.weekendEnabled) state.mode = "semaine";
		},
		setMode(state, action) {
			state.mode = action.payload;
		},
		setHour(state, action) {
			const { mode, value } = action.payload;
			const { mm } = splitHHMM(state.times[mode]);
			state.times[mode] = `${value}:${mm}`;
		},
		setMinute(state, action) {
			const { mode, value } = action.payload;
			const { hh } = splitHHMM(state.times[mode]);
			state.times[mode] = `${hh}:${value}`;
		},
		resetAll: () => DEFAULTS,
	},
});
const { actions, reducer: settingsReducer } = settingsSlice;

const persistConfig = {
	key: STORAGE_KEY,
	storage: AsyncStorage,
	whitelist: ["mode", "times", "weekendEnabled"],
};
const persistedReducer = persistReducer(persistConfig, settingsReducer);
const store = configureStore({
	reducer: { settings: persistedReducer },
	middleware: (gDM) => gDM({ serializableCheck: false }),
});
const persistor = persistStore(store);

/* ============================== UI Bits ============================== */
const Segmented = ({ value, onChange }) => (
	<View style={styles.segmented}>
		{["semaine", "weekend"].map((m) => {
			const active = value === m;
			return (
				<TouchableOpacity key={m} style={[styles.segmentBtn, active ? styles.segmentBtnActive : styles.segmentBtnIdle]} onPress={() => onChange(m)}>
					<Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{m === "semaine" ? "Semaine" : "Week-end"}</Text>
				</TouchableOpacity>
			);
		})}
	</View>
);

/* ============================ Écran principal ============================ */
const HomeScreen = () => {
	const dispatch = useDispatch();
	const { mode: storeMode, times, weekendEnabled: storeWeekend } = useSelector((s) => s.settings);

	const [weekendEnabled, setWeekendEnabled] = useState(storeWeekend);
	const [mode, setMode] = useState(storeMode ?? (isWeekend() ? "weekend" : "semaine"));

	/* -------- Initialisation -------- */
	useEffect(() => {
		dispatch(actions.ensureModeInitialized());
	}, [dispatch]);

	/* -------- Synchronisation Redux -------- */
	useEffect(() => {
		if (storeWeekend !== weekendEnabled) dispatch(actions.setWeekendEnabled(weekendEnabled));
	}, [weekendEnabled, storeWeekend, dispatch]);

	useEffect(() => {
		if (storeMode !== mode) dispatch(actions.setMode(mode));
	}, [mode, storeMode, dispatch]);

	useEffect(() => {
		if (!weekendEnabled && mode !== "semaine") setMode("semaine");
	}, [weekendEnabled, mode]);

	/* -------- Gestion inputs -------- */
	const { hh: hourRedux, mm: minuteRedux } = splitHHMM(times[mode]);
	const [hourInput, setHourInput] = useState(hourRedux);
	const [minuteInput, setMinuteInput] = useState(minuteRedux);

	useEffect(() => {
		const { hh, mm } = splitHHMM(times[mode]);
		setHourInput(hh);
		setMinuteInput(mm);
	}, [mode, times]);

	const onHourChange = (v) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setHourInput(clean);
		dispatch(actions.setHour({ mode, value: clean }));
	};
	const onMinuteChange = (v) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setMinuteInput(clean);
		dispatch(actions.setMinute({ mode, value: clean }));
	};

	/* -------- Calcul temps restant -------- */
	const [tick, setTick] = useState(0);
	const refresh = useCallback(() => setTick((t) => t + 1), []);
	useEffect(() => {
		const id = setInterval(refresh, 60_000);
		return () => clearInterval(id);
	}, [refresh]);

	const remain = useMemo(() => {
		const hh = clamp(parseInt(hourRedux || "0", 10), 0, 23);
		const mm = clamp(parseInt(minuteRedux || "0", 10), 0, 59);
		return computeRemaining(hh, mm);
	}, [hourRedux, minuteRedux, tick]);

	/* ------------ Notifications : permissions et canal ------------ */
	useEffect(() => {
		if (Device.isDevice) {
			Notifications.requestPermissionsAsync();
			Notifications.setNotificationChannelAsync("sleep-reminder", {
				name: "Rappels sommeil",
				importance: Notifications.AndroidImportance.DEFAULT,
			});
		}
	}, []);

	/* ------------ Notifications : planification et réinitialisation ----------- */
	const OFFSETS_MIN = [-600, -510, -480]; // 10 h, 8 h30, 8 h avant
	const scheduleSleepNotifications = async (wakeDate) => {
		const ids = [];
		for (const offset of OFFSETS_MIN) {
			const trigger = new Date(wakeDate.getTime() + offset * 60_000);
			ids.push(
				await Notifications.scheduleNotificationAsync({
					content: {
						title: "Rappel sommeil",
						body: `Coucher maintenant → ${Math.abs(offset)} min avant 8 h de sommeil`,
						sound: "default",
					},
					trigger,
				})
			);
		}
		return ids;
	};
	const cancelSleepNotifications = async () => Notifications.cancelAllScheduledNotificationsAsync();

	useEffect(() => {
		(async () => {
			await cancelSleepNotifications();

			const hh = clamp(parseInt(hourRedux || "0", 10), 0, 23);
			const mm = clamp(parseInt(minuteRedux || "0", 10), 0, 59);
			const now = new Date();
			const wake = new Date(now);
			wake.setHours(hh, mm, 0, 0);
			if (wake <= now) wake.setDate(wake.getDate() + 1);

			await scheduleSleepNotifications(wake);
		})();
	}, [hourRedux, minuteRedux, mode]);

	const colorStyle = colorFromTotal(remain.total);

	/* -------- UI -------- */
	return (
		<ImageBackground source={require("./assets/nuages_1.jpg")} style={styles.bg} resizeMode="cover">
			<SafeAreaView style={styles.container}>
				<View style={styles.card}>
					{/* Switch Week-end */}
					<View style={styles.row}>
						<Text style={styles.title}>Afficher un horaire distinct week-end</Text>
						<Switch style={styles.switch} value={weekendEnabled} onValueChange={setWeekendEnabled} />
					</View>

					{/* Onglets */}
					{weekendEnabled && (
						<View style={{ marginBottom: 8 }}>
							<Segmented value={mode} onChange={setMode} />
						</View>
					)}

					{/* Entrée HH:MM */}
					<View style={styles.centerInputs}>
						<Text style={styles.label}>Heure de réveil :</Text>
						<View style={styles.timeRow}>
							<TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={hourInput} onChangeText={onHourChange} placeholder="HH" textAlign="center" />
							<Text style={styles.colon}>:</Text>
							<TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={minuteInput} onChangeText={onMinuteChange} placeholder="MM" textAlign="center" />
						</View>
					</View>

					{/* Temps restant */}
					<View style={[styles.sleepBox, colorStyle]}>
						<Text style={styles.sleepText}>
							{two(remain.h)}:{two(remain.m)}
						</Text>
					</View>

					{/* Bouton Refresh */}
					<Pressable style={styles.refreshButton} onPress={refresh}>
						<Text style={styles.refreshText}>Refresh</Text>
					</Pressable>
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

/* =============================== Styles =============================== */
const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
	card: { width: "100%", maxWidth: 460, minHeight: 480 },
	row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	title: { fontSize: 16, fontWeight: "600", marginBottom: 16 },
	switch: { marginBottom: 16 },
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
	sleepBox: { alignSelf: "center", width: 220, height: 220, borderRadius: 16, alignItems: "center", justifyContent: "center" },
	sleepText: { fontSize: 42, fontWeight: "800", color: "#fff", letterSpacing: 1 },
	boxGood: { backgroundColor: "#198754" },
	boxWarn: { backgroundColor: "#ffc107" },
	boxBad: { backgroundColor: "#dc3545" },
	boxVeryLow: { backgroundColor: "#0d0d0d" },
	bg: { flex: 1, justifyContent: "center", alignItems: "center" },
	centerInputs: { flex: 1, alignItems: "center", justifyContent: "center", marginVertical: 12 },

	refreshButton: {
		marginTop: 20,
		alignSelf: "center",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 6,
		backgroundColor: "#007bff",
	},
	refreshText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
