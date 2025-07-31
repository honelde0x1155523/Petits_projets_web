import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, ImageBackground, Platform, Linking, Alert } from "react-native";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer, persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";
import * as Notifications from "expo-notifications";

/* ================== Notifications: handler foreground ================== */
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: false,
		shouldSetBadge: false,
	}),
});

/* ========================= Types & Constantes ========================= */
const DEFAULTS = {
	mode: null, // "semaine" | "weekend"
	times: { semaine: "06:30", weekend: "10:00" }, // HH:mm (peut contenir des valeurs partielles pendant l'édition)
	weekendEnabled: true,
	notificationsEnabled: false,
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
const joinHHMM = (hh, mm, pad = true) => (pad ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : `${hh}:${mm}`);

const computeRemaining = (hh, mm, now = new Date()) => {
	const wake = new Date(now);
	wake.setHours(hh, mm, 0, 0);
	if (wake <= now) wake.setDate(wake.getDate() + 1);
	const diffMin = Math.round((wake.getTime() - now.getTime()) / 60000);
	const h = Math.floor(diffMin / 60);
	const m = diffMin % 60;
	return { h, m, total: h + m / 60 };
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
		setTime(state, action) {
			const { mode, value } = action.payload; // conserve tel quel (peut être partiel)
			state.times[mode] = value;
		},
		setHour(state, action) {
			const { mode, value } = action.payload; // conserve tel quel (peut être partiel)
			const { mm } = splitHHMM(state.times[mode]);
			// Aucune normalisation ici
			state.times[mode] = `${value}:${mm}`;
		},
		setMinute(state, action) {
			const { mode, value } = action.payload; // conserve tel quel (peut être partiel)
			const { hh } = splitHHMM(state.times[mode]);
			// Aucune normalisation ici
			state.times[mode] = `${hh}:${value}`;
		},
		resetAll() {
			return DEFAULTS;
		},
		setNotificationsEnabled(state, action) {
			state.notificationsEnabled = action.payload;
		},
	},
});

const { actions, reducer: settingsReducer } = settingsSlice;

const persistConfig = {
	key: STORAGE_KEY,
	storage: AsyncStorage,
	whitelist: ["mode", "times", "weekendEnabled", "notificationsEnabled"],
};
const persistedReducer = persistReducer(persistConfig, settingsReducer);

const store = configureStore({
	reducer: { settings: persistedReducer },
	middleware: (gDM) => gDM({ serializableCheck: false }),
});
const persistor = persistStore(store);

/* =================== Notifications: calcul & planif =================== */
const WEEKDAYS = { SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7 }; // Expo: 1=Dim, 7=Sam
const mod = (n, m) => ((n % m) + m) % m;

function computeTimeMinus(baseHour, baseMinute, deltaMinutes) {
	const total = baseHour * 60 + baseMinute - deltaMinutes;
	const hour = mod(Math.floor(total / 60), 24);
	const minute = mod(total, 60);
	const dayDelta = total < 0 ? -1 : 0;
	return { hour, minute, dayDelta };
}

async function planifierNotificationsDuJour(hhmm) {
	const now = new Date();
	const weekdayJs = now.getDay(); // 0 = dimanche, 6 = samedi
	if (weekdayJs === 0 || weekdayJs === 6) return; // pas de notif le week-end

	const { hh, mm } = splitHHMM(hhmm || "06:30");
	const wakeHour = clamp(parseInt(hh || "0", 10), 0, 23);
	const wakeMinute = clamp(parseInt(mm || "0", 10), 0, 59);

	// coucher = lever - 8h
	const bedtimeHour = mod(wakeHour - 8, 24);
	const bedtimeMinute = wakeMinute;

	const minus2h = computeTimeMinus(bedtimeHour, bedtimeMinute, 120);
	const minus30 = computeTimeMinus(bedtimeHour, bedtimeMinute, 30);

	const expoWeekdayToday = weekdayJs === 0 ? WEEKDAYS.SUN : weekdayJs + 1;

	await ensurePermissionsAndChannel();
	await cancelAllSleepNotifications();

	// −2 h
	await Notifications.scheduleNotificationAsync({
		content: { title: "Coucher dans 2 h", body: "Préparez-vous à dormir pour viser 8 h de sommeil." },
		trigger: { weekday: expoWeekdayToday, hour: minus2h.hour, minute: minus2h.minute, repeats: true },
	});

	// −30 min
	await Notifications.scheduleNotificationAsync({
		content: { title: "Coucher dans 30 min", body: "Il est bientôt l’heure de se coucher." },
		trigger: { weekday: expoWeekdayToday, hour: minus30.hour, minute: minus30.minute, repeats: true },
	});
}

async function ensurePermissionsAndChannel() {
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("sleep", {
			name: "Sommeil",
			importance: Notifications.AndroidImportance.MAX,
		});
	}
	const { status } = await Notifications.getPermissionsAsync();
	if (status !== "granted") {
		const res = await Notifications.requestPermissionsAsync();
		if (res.status !== "granted") throw new Error("Permission notification refusée");
	}
}

async function cancelAllSleepNotifications() {
	await Notifications.cancelAllScheduledNotificationsAsync();
}

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
	const { mode: storeMode, times, weekendEnabled: storeWeekend, notificationsEnabled } = useSelector((s) => s.settings);

	const [weekendEnabled, setWeekendEnabled] = useState(storeWeekend);
	const [mode, setMode] = useState(storeMode ?? (isWeekend() ? "weekend" : "semaine"));

	// Initialisation
	useEffect(() => {
		dispatch(actions.ensureModeInitialized());
	}, [dispatch]);

	// Sync des switches vers Redux
	useEffect(() => {
		if (storeWeekend !== weekendEnabled) dispatch(actions.setWeekendEnabled(weekendEnabled));
	}, [weekendEnabled, storeWeekend, dispatch]);

	useEffect(() => {
		if (storeMode !== mode) dispatch(actions.setMode(mode));
	}, [mode, storeMode, dispatch]);

	// Si week-end désactivé, forcer “semaine”
	useEffect(() => {
		if (!weekendEnabled && mode !== "semaine") setMode("semaine");
	}, [weekendEnabled, mode]);

	// Heures/minutes Redux (source de vérité long terme)
	const { hh: hourRedux, mm: minuteRedux } = splitHHMM(times[mode]);

	// États locaux d’édition
	const [hourInput, setHourInput] = useState(hourRedux);
	const [minuteInput, setMinuteInput] = useState(minuteRedux);

	// Afficher les valeurs du mode sélectionné (sans normaliser)
	useEffect(() => {
		const { hh, mm } = splitHHMM(times[mode]);
		setHourInput(hh);
		setMinuteInput(mm);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode]);

	// HH
	const onHourChange = (v) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setHourInput(clean);
		// stocker exactement la saisie
		dispatch(actions.setHour({ mode, value: clean }));

		// normalisation temporaire uniquement pour planifier
		if (clean.length === 2 && notificationsEnabled) {
			(async () => {
				const hh = two(clamp(parseInt(clean || "0", 10), 0, 23));
				const mm = two(clamp(parseInt(minuteInput || "0", 10), 0, 59));
				await planifierNotificationsDuJour(joinHHMM(hh, mm));
			})();
		}
	};

	// MM
	const onMinuteChange = (v) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setMinuteInput(clean);
		// stocker exactement la saisie
		dispatch(actions.setMinute({ mode, value: clean }));

		// normalisation temporaire uniquement pour planifier
		if (notificationsEnabled) {
			(async () => {
				const hh = two(clamp(parseInt(hourInput || "0", 10), 0, 23));
				const mm = two(clamp(parseInt(clean || "0", 10), 0, 59));
				await planifierNotificationsDuJour(joinHHMM(hh, mm));
			})();
		}
	};

	const onHourBlur = async () => {
		dispatch(actions.setHour({ mode, value: hourInput }));
		if (notificationsEnabled) {
			const hh = two(clamp(parseInt(hourInput || "0", 10), 0, 23));
			const mm = two(clamp(parseInt(minuteInput || "0", 10), 0, 59));
			await planifierNotificationsDuJour(joinHHMM(hh, mm));
		}
	};

	const onMinuteBlur = async () => {
		dispatch(actions.setMinute({ mode, value: minuteInput }));
		if (notificationsEnabled) {
			const hh = two(clamp(parseInt(hourInput || "0", 10), 0, 23));
			const mm = two(clamp(parseInt(minuteInput || "0", 10), 0, 59));
			await planifierNotificationsDuJour(joinHHMM(hh, mm));
		}
	};

	// Compte à rebours — basé sur Redux
	const [tick, setTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 60_000);
		return () => clearInterval(id);
	}, []);
	const remain = useMemo(() => {
		const hh = clamp(parseInt(hourRedux || "0", 10) || 0, 0, 23);
		const mm = clamp(parseInt(minuteRedux || "0", 10) || 0, 0, 59);
		return computeRemaining(hh, mm);
	}, [hourRedux, minuteRedux, tick]);

	const colorStyle = colorFromTotal(remain.total);

	/* ---------------------- Notifications: toggle ---------------------- */
	const onToggleNotifications = async (value) => {
		dispatch(actions.setNotificationsEnabled(value));

		if (value) {
			const settings = await Notifications.getPermissionsAsync();

			if (settings.status !== "granted") {
				if (!settings.canAskAgain) {
					Alert.alert("Notifications bloquées", "Veuillez autoriser les notifications dans les réglages du téléphone.", [
						{ text: "Plus tard", style: "cancel" },
						{ text: "Ouvrir les réglages", onPress: () => Linking.openSettings() },
					]);
					return;
				} else {
					const res = await Notifications.requestPermissionsAsync();
					if (res.status !== "granted") {
						Alert.alert("Refusé", "Les notifications ont été refusées.");
						return;
					}
				}
			}
			// Valeurs normalisées pour planification uniquement
			const hh = two(clamp(parseInt(hourInput || "0", 10), 0, 23));
			const mm = two(clamp(parseInt(minuteInput || "0", 10), 0, 59));
			const hhmm = joinHHMM(hh, mm);

			// Mise à jour du store SANS normalisation (conserve exactement la saisie)
			if (joinHHMM(hourInput, minuteInput, false) !== joinHHMM(hourRedux, minuteRedux, false)) {
				dispatch(actions.setTime({ mode, value: joinHHMM(hourInput, minuteInput, false) }));
			}

			await planifierNotificationsDuJour(hhmm);
		} else {
			// Désactivation : annuler les notifications planifiées
			await cancelAllSleepNotifications();
		}
	};

	return (
		<ImageBackground source={require("./assets/nuages_1.jpg")} style={styles.bg} resizeMode="cover">
			<SafeAreaView style={styles.container}>
				<View style={styles.card}>
					{/* Switch notifications */}
					<View style={styles.row}>
						<Text style={styles.label}>Activer les notifications</Text>
						<Switch value={notificationsEnabled} onValueChange={onToggleNotifications} />
					</View>

					{/* Switch Week-end */}
					<View style={styles.row}>
						<Text style={styles.title}>Afficher un horaire distinct week-end</Text>
						<Switch value={weekendEnabled} onValueChange={setWeekendEnabled} />
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
							<TextInput
								style={styles.input}
								keyboardType="numeric"
								maxLength={2}
								value={hourInput}
								onChangeText={onHourChange}
								onBlur={onHourBlur}
								placeholder="HH"
								textAlign="center"
							/>
							<Text style={styles.colon}>:</Text>
							<TextInput
								style={styles.input}
								keyboardType="numeric"
								maxLength={2}
								value={minuteInput}
								onChangeText={onMinuteChange}
								onBlur={onMinuteBlur}
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

/* =============================== Styles =============================== */
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
		minHeight: 480,
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
		marginVertical: 12,
	},
});

/* =========================== Store bootstrap ========================== */
function makeStore() {
	return store;
}
