import React, { useEffect, useMemo, useState, useCallback } from "react";
import { SafeAreaView, View, Text, TextInput, Switch, StyleSheet, ImageBackground, TouchableOpacity, Pressable, AppState, AppStateStatus } from "react-native";
import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer, persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

/* ========================= Types & Constantes ========================= */

type Mode = "semaine" | "weekend";
interface TimesState {
	semaine: string;
	weekend: string;
}
interface SettingsState {
	mode: Mode | null;
	times: TimesState;
	weekendEnabled: boolean;
}

const DEFAULTS: SettingsState = {
	mode: null,
	times: { semaine: "06:30", weekend: "10:00" },
	weekendEnabled: true,
};
const STORAGE_KEY = "temps_de_someil_restant";

/* ============================== Helpers ============================== */

const isWeekend = (d: Date = new Date()) => [0, 6].includes(d.getDay());

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const two = (n: number) => String(n).padStart(2, "0");

const splitHHMM = (s: string) => {
	const [hh = "00", mm = "00"] = (s || "").split(":");
	return { hh, mm };
};

const computeRemaining = (hh: number, mm: number, now: Date = new Date()) => {
	const wake = new Date(now);
	wake.setHours(hh, mm, 0, 0);
	if (wake <= now) wake.setDate(wake.getDate() + 1);
	const diffMin = Math.round((wake.getTime() - now.getTime()) / 60000);
	return { h: Math.floor(diffMin / 60), m: diffMin % 60, total: diffMin / 60 };
};

const colorFromTotal = (t: number) => (t >= 8 ? styles.boxGood : t >= 6 ? styles.boxWarn : t >= 3 ? styles.boxBad : styles.boxVeryLow);

/* ============================ Redux Slice ============================ */

const settingsSlice = createSlice({
	name: "settings",
	initialState: DEFAULTS,
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
		setHour(state, action: PayloadAction<{ mode: Mode; value: string }>) {
			const { mode, value } = action.payload;
			const { mm } = splitHHMM(state.times[mode]);
			state.times[mode] = `${value}:${mm}`;
		},
		setMinute(state, action: PayloadAction<{ mode: Mode; value: string }>) {
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

interface SegmentedProps {
	value: Mode;
	onChange: (m: Mode) => void;
}
const Segmented: React.FC<SegmentedProps> = ({ value, onChange }) => (
	<View style={styles.segmented}>
		{(["semaine", "weekend"] as Mode[]).map((m) => {
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
	const { mode: storeMode, times, weekendEnabled: storeWeekend } = useSelector((s: { settings: SettingsState }) => s.settings);

	const [weekendEnabled, setWeekendEnabled] = useState<boolean>(storeWeekend);
	const [mode, setMode] = useState<Mode>(storeMode ?? (isWeekend() ? "weekend" : "semaine"));

	/* -------- Initialisation + retour foreground -------- */
	useEffect(() => {
		if (weekendEnabled) {
			setMode(isWeekend() ? "weekend" : "semaine");
		} else {
			setMode("semaine");
		}
	}, [weekendEnabled]);

	const [tick, setTick] = useState(0);

	useEffect(() => {
		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			if (state === "active") {
				if (weekendEnabled) {
					const desired: Mode = isWeekend() ? "weekend" : "semaine";
					if (mode !== desired) setMode(desired);
				}
				setTick((t) => t + 1); // force le recalcul (remain)
			}
		});
		return () => sub.remove();
	}, [weekendEnabled, mode]);

	/* -------- Synchronisation Redux -------- */
	useEffect(() => {
		if (storeWeekend !== weekendEnabled) dispatch(actions.setWeekendEnabled(weekendEnabled));
	}, [weekendEnabled, storeWeekend, dispatch]);

	useEffect(() => {
		if (storeMode !== mode) dispatch(actions.setMode(mode));
	}, [mode, storeMode, dispatch]);

	/* -------- Gestion inputs -------- */
	const { hh: hourRedux, mm: minuteRedux } = splitHHMM(times[mode]);
	const [hourInput, setHourInput] = useState(hourRedux);
	const [minuteInput, setMinuteInput] = useState(minuteRedux);

	useEffect(() => {
		const { hh, mm } = splitHHMM(times[mode]);
		setHourInput(hh);
		setMinuteInput(mm);
	}, [mode, times]);

	const onHourChange = (v: string) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setHourInput(clean);
		dispatch(actions.setHour({ mode, value: clean }));
	};
	const onMinuteChange = (v: string) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		setMinuteInput(clean);
		dispatch(actions.setMinute({ mode, value: clean }));
	};

	/* -------- Calcul temps restant (uniquement sur démarrage/foreground/refresh ou modifs utilisateur) -------- */
	const refresh = useCallback(() => {
		if (weekendEnabled) {
			const desired: Mode = isWeekend() ? "weekend" : "semaine";
			if (mode !== desired) setMode(desired);
		}
		setTick((t) => t + 1);
	}, [mode, weekendEnabled]);

	const remain = useMemo(() => {
		const hh = clamp(parseInt(hourRedux || "0", 10), 0, 23);
		const mm = clamp(parseInt(minuteRedux || "0", 10), 0, 59);
		return computeRemaining(hh, mm);
	}, [hourRedux, minuteRedux, tick]);

	/* ------------ Notifications ------------ */
	useEffect(() => {
		if (Device.isDevice) {
			Notifications.requestPermissionsAsync();
			Notifications.setNotificationChannelAsync("sleep-reminder", {
				name: "Rappels sommeil",
				importance: Notifications.AndroidImportance.DEFAULT,
			});
		}
	}, []);

	const OFFSETS_MIN = [-600, -510, -480];

	const scheduleSleepNotifications = async (wakeDate: Date) => {
		const ids: string[] = [];
		for (const offset of OFFSETS_MIN) {
			const trigger: Notifications.NotificationTriggerInput = {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: new Date(wakeDate.getTime() + offset * 60_000),
			};
			ids.push(
				await Notifications.scheduleNotificationAsync({
					content: {
						title: "Attention, il faut dormir",
						body: `Il vous reste ${Math.floor(Math.abs(offset) / 60)} h ${Math.abs(offset) % 60} min pour dormir 8 h — il est bientôt l'heure de vous coucher`,
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
					<View style={styles.row}>
						<Text style={styles.title}>Afficher un horaire distinct week-end</Text>
						<Switch style={styles.switch} value={weekendEnabled} onValueChange={setWeekendEnabled} />
					</View>

					{weekendEnabled && <Segmented value={mode} onChange={setMode} />}

					<View style={styles.centerInputs}>
						<Text style={styles.label}>Heure de réveil :</Text>
						<View style={styles.timeRow}>
							<TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={hourInput} onChangeText={onHourChange} placeholder="HH" textAlign="center" />
							<Text style={styles.colon}>:</Text>
							<TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={minuteInput} onChangeText={onMinuteChange} placeholder="MM" textAlign="center" />
						</View>
					</View>

					<View style={[styles.sleepBox, colorStyle]}>
						<Text style={styles.sleepText}>
							{two(remain.h)}:{two(remain.m)}
						</Text>
					</View>

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

const COLORS = {
	primary: "#0d6efd",
	success: "#198754",
	warning: "#ffc107",
	danger: "#dc3545",
	dark: "#0d0d0d",
	border: "#c8d3e8",
	segmentBg: "#eef3ff",
	white: "#fff",
	refresh: "#007bff",
};

const SPACING = {
	xs: 4,
	s: 8,
	m: 12,
	l: 16,
	xl: 20,
};

const RADII = {
	s: 6,
	m: 8,
	l: 10,
	xl: 16,
};

const FONTS = {
	base: 16,
	strong: "600" as const,
	heavy: "800" as const,
	large: 22,
	clock: 42,
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: SPACING.l,
	},

	card: {
		width: "100%",
		maxWidth: 460,
		minHeight: 480,
		justifyContent: "center",
		gap: SPACING.xl,
	},

	centerInputs: {
		alignItems: "center",
		justifyContent: "center",
		gap: SPACING.s,
	},

	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},

	title: {
		fontSize: 16,
		fontWeight: "600",
	},

	switch: {},

	label: {},

	timeRow: {
		flexDirection: "row",
		alignItems: "center",
	},

	input: {
		width: 64,
		height: 56,
		fontSize: 22,
		borderWidth: 1,
		borderColor: COLORS.border,
		borderRadius: 8,
		backgroundColor: COLORS.white,
		textAlign: "center",
	},

	colon: {
		fontSize: 22,
		fontWeight: "700",
		marginHorizontal: 8,
	},

	segmented: {
		flexDirection: "row",
		backgroundColor: COLORS.segmentBg,
		borderRadius: 10,
		padding: 4,
	},

	segmentBtn: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 8,
		alignItems: "center",
	},

	segmentBtnActive: { backgroundColor: COLORS.primary },
	segmentBtnIdle: { backgroundColor: "transparent" },

	segmentLabel: { fontWeight: "600", color: COLORS.primary },
	segmentLabelActive: { color: COLORS.white },

	sleepBox: {
		alignSelf: "center",
		width: 220,
		height: 220,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},

	sleepText: {
		fontSize: 42,
		fontWeight: "800",
		color: COLORS.white,
		letterSpacing: 1,
	},

	boxGood: { backgroundColor: COLORS.success },
	boxWarn: { backgroundColor: COLORS.warning },
	boxBad: { backgroundColor: COLORS.danger },
	boxVeryLow: { backgroundColor: COLORS.dark },

	bg: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},

	refreshButton: {
		alignSelf: "center",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 6,
		backgroundColor: COLORS.refresh,
	},

	refreshText: {
		color: COLORS.white,
		fontWeight: "600",
		fontSize: 16,
	},
});
