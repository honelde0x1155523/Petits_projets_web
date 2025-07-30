// App.tsx
import "react-native-reanimated";
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Provider, useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// =============== Thème & utilitaires ===============
const COLORS = {
	warm1: "#FFB703",
	warm2: "#FB8500",
	gray1: "#f8f9fa",
	gray2: "#e9ecef",
	gray3: "#ced4da",
	text: "#212529",
	subtle: "#6c757d",
	danger: "#dc3545",
	success: "#198754",
};

const pad = (n: number) => String(n).padStart(2, "0");
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const minutesToHm = (total: number) => {
	const sign = total < 0 ? "-" : "";
	const m = Math.abs(total);
	const h = Math.floor(m / 60),
		mm = m % 60;
	return sign + (h ? `${h} h ${pad(mm)} min` : `${mm} min`);
};
const timeToMinutes = (t: string | undefined) => {
	if (!t) return 8 * 60 + 25;
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
};
const minutesToTime = (m: number) => {
	m = ((m % 1440) + 1440) % 1440;
	const h = Math.floor(m / 60),
		mm = m % 60;
	return `${pad(h)}:${pad(mm)}`;
};
const nextDateForTime = (hhmm: string) => {
	const now = new Date();
	const [h, m] = hhmm.split(":").map(Number);
	const d = new Date(now);
	d.setHours(h, m, 0, 0);
	if (d <= now) d.setDate(d.getDate() + 1);
	return d;
};
const relativeFromNow = (target: Date) => {
	const now = new Date();
	const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
	if (diffMin > 0) return `dans ${minutesToHm(diffMin)}`;
	if (diffMin < 0) return `il y a ${minutesToHm(-diffMin)}`;
	return "maintenant";
};

// =============== Domain model ===============
type Step = {
	id: string;
	label: string;
	minutes: number;
	min: number;
	max: number;
	enabled: boolean;
};

type ProfileData = {
	steps: Step[];
	intervalToilettes: number; // minutes
	departureTime: string; // "HH:MM"
};

const STORAGE_NS = "a_faire_avant_de_partir";
const PROFILE_DEFAULT_NAME = "routine du matin";

const DEFAULT_STEPS: Step[] = [
	{ id: "wake", label: "Se lever", minutes: 30, min: 0, max: 240, enabled: true },
	{ id: "toilette1", label: "Toilette 1", minutes: 15, min: 0, max: 120, enabled: true },
	{ id: "prep", label: "Mise en condition (coiffer / raser)", minutes: 15, min: 0, max: 120, enabled: true },
	{ id: "eat", label: "Manger", minutes: 15, min: 0, max: 120, enabled: true },
	{ id: "toilette2", label: "Toilette 2", minutes: 15, min: 0, max: 120, enabled: true },
	{ id: "buffer", label: "Battement (s'habiller + vérifier fenêtres)", minutes: 10, min: 0, max: 120, enabled: true },
];
const DEFAULT_INTERVAL_TOILETTES = 60;

const defaultProfileData = (): ProfileData => ({
	steps: JSON.parse(JSON.stringify(DEFAULT_STEPS)),
	intervalToilettes: DEFAULT_INTERVAL_TOILETTES,
	departureTime: "08:25",
});

// =============== Redux (slice + persist) ===============
type Manifest = { active: string; order: string[] };
type RootState = {
	manifest: Manifest;
	profiles: Record<string, ProfileData>;
};

const initialState: RootState = {
	manifest: { active: PROFILE_DEFAULT_NAME, order: [PROFILE_DEFAULT_NAME] },
	profiles: { [PROFILE_DEFAULT_NAME]: defaultProfileData() },
};

const slice = createSlice({
	name: "routine",
	initialState,
	reducers: {
		setActiveProfile(state, action: PayloadAction<string>) {
			if (state.manifest.order.includes(action.payload)) state.manifest.active = action.payload;
		},
		addProfile(state, action: PayloadAction<{ name?: string } | undefined>) {
			const base = action?.payload?.name?.trim() || "Préparation";
			let name = base;
			if (state.manifest.order.includes(name)) {
				let i = 2;
				while (state.manifest.order.includes(`${base} ${i}`)) i++;
				name = `${base} ${i}`;
			}
			state.manifest.order.push(name);
			state.manifest.active = name;
			state.profiles[name] = defaultProfileData();
		},
		renameProfile(state, action: PayloadAction<{ oldName: string; newName: string }>) {
			const { oldName, newName: raw } = action.payload;
			if (!state.manifest.order.includes(oldName)) return;
			const newName = raw.trim() || oldName;
			if (newName === oldName) return;

			let finalName = newName;
			if (state.manifest.order.includes(finalName)) {
				let i = 2;
				while (state.manifest.order.includes(`${newName} (${i})`)) i++;
				finalName = `${newName} (${i})`;
			}

			// Move data
			state.profiles[finalName] = state.profiles[oldName] ?? defaultProfileData();
			delete state.profiles[oldName];

			state.manifest.order = state.manifest.order.map((n) => (n === oldName ? finalName : n));
			if (state.manifest.active === oldName) state.manifest.active = finalName;
		},
		deleteProfile(state, action: PayloadAction<{ name: string }>) {
			const { name } = action.payload;
			if (!state.manifest.order.includes(name)) return;

			delete state.profiles[name];
			state.manifest.order = state.manifest.order.filter((n) => n !== name);
			if (state.manifest.order.length === 0) {
				state.manifest.order = [PROFILE_DEFAULT_NAME];
				state.manifest.active = PROFILE_DEFAULT_NAME;
				state.profiles[PROFILE_DEFAULT_NAME] = defaultProfileData();
			} else {
				state.manifest.active = state.manifest.order[0];
			}
		},

		// Profile data updates
		setDepartureTime(state, action: PayloadAction<string>) {
			const p = state.manifest.active;
			if (!state.profiles[p]) return;
			const v = action.payload.match(/^\d{1,2}:\d{2}$/) ? action.payload : state.profiles[p].departureTime;
			state.profiles[p].departureTime = v;
		},
		setIntervalToilettes(state, action: PayloadAction<number>) {
			const p = state.manifest.active;
			if (!state.profiles[p]) return;
			state.profiles[p].intervalToilettes = clamp(Math.round(action.payload || 0), 0, 240);
		},
		resetProfile(state) {
			const p = state.manifest.active;
			state.profiles[p] = defaultProfileData();
		},

		addStep(state) {
			const p = state.manifest.active;
			if (!state.profiles[p]) return;
			const id = `custom_${Date.now()}`;
			state.profiles[p].steps.push({ id, label: "Activité à faire", minutes: 15, min: 0, max: 600, enabled: true });
		},
		updateStep(state, action: PayloadAction<{ id: string; patch: Partial<Omit<Step, "id">> }>) {
			const p = state.manifest.active;
			const s = state.profiles[p]?.steps;
			if (!s) return;
			const idx = s.findIndex((x) => x.id === action.payload.id);
			if (idx === -1) return;
			const cur = s[idx];
			const patch = action.payload.patch;
			s[idx] = {
				...cur,
				...patch,
				minutes: patch.minutes !== undefined ? clamp(Math.round(patch.minutes || 0), cur.min ?? 0, cur.max ?? 600) : cur.minutes,
			};
		},
		toggleStep(state, action: PayloadAction<{ id: string; enabled: boolean }>) {
			const p = state.manifest.active;
			const s = state.profiles[p]?.steps;
			if (!s) return;
			const idx = s.findIndex((x) => x.id === action.payload.id);
			if (idx === -1) return;
			s[idx].enabled = action.payload.enabled;
		},
		deleteStep(state, action: PayloadAction<{ id: string }>) {
			const p = state.manifest.active;
			const s = state.profiles[p]?.steps;
			if (!s) return;
			state.profiles[p].steps = s.filter((x) => x.id !== action.payload.id);
		},
		reorderSteps(state, action: PayloadAction<{ from: number; to: number }>) {
			const p = state.manifest.active;
			const s = state.profiles[p]?.steps;
			if (!s) return;
			const { from, to } = action.payload;
			const arr = [...s];
			const [moved] = arr.splice(from, 1);
			arr.splice(to, 0, moved);
			state.profiles[p].steps = arr;
		},
	},
});

const { setActiveProfile, addProfile, renameProfile, deleteProfile, setDepartureTime, setIntervalToilettes, resetProfile, addStep, updateStep, toggleStep, deleteStep, reorderSteps } = slice.actions;

const persistConfig = { key: STORAGE_NS, storage: AsyncStorage, version: 1 };
const store = configureStore({
	reducer: persistReducer(persistConfig, slice.reducer),
	middleware: (gDM) => gDM({ serializableCheck: false }),
});
const persistor = persistStore(store);
type AppDispatch = typeof store.dispatch;

// =============== Sélecteurs dérivés ===============
const useActiveProfile = () => {
	return useSelector((s: RootState) => {
		if (!s.manifest || !s.profiles) return { key: "", profile: defaultProfileData(), manifest: { active: "", order: [] } };

		const key = s.manifest.active;
		const profile = s.profiles[key] ?? defaultProfileData();
		return { key, profile, manifest: s.manifest };
	});
};

const useMetrics = () => {
	const { profile } = useActiveProfile();
  const { steps = [], intervalToilettes = 0, departureTime = "08:25" } = profile;

	const applies = useMemo(() => {
		const idxEat = steps.findIndex((s) => s.id === "eat");
		const idxT2 = steps.findIndex((s) => s.id === "toilette2");
		const eatEnabled = idxEat !== -1 && steps[idxEat].enabled !== false;
		const t2Enabled = idxT2 !== -1 && steps[idxT2].enabled !== false;
		return eatEnabled && t2Enabled && idxEat < idxT2;
	}, [steps]);

	const total = useMemo(() => {
		const sum = steps.reduce((acc, st) => acc + (st.enabled !== false ? st.minutes || 0 : 0), 0);
		return sum + (applies ? intervalToilettes || 0 : 0);
	}, [steps, applies, intervalToilettes]);

	const depStr = departureTime || "08:25";
	const dep = nextDateForTime(depStr);
	const now = new Date();
	const minUntilDep = Math.round((dep.getTime() - now.getTime()) / 60000);
	const slackMin = minUntilDep - total;

	const latestStartMinutes = timeToMinutes(depStr) - total;
	const latestStart = minutesToTime(latestStartMinutes);

	const latestStartDate = new Date(dep);
	latestStartDate.setMinutes(latestStartDate.getMinutes() - total);

	// progress bar on a rolling 8h window before departure
	const startWindow = new Date(dep);
	startWindow.setHours(startWindow.getHours() - 8);
	const totalWindow = dep.getTime() - startWindow.getTime();
	const elapsed = Math.max(0, Math.min(dep.getTime() - now.getTime(), totalWindow));
	const pct = clamp(Math.round((elapsed / totalWindow) * 100), 0, 100);

	return {
		applies,
		total,
		totalLabel: minutesToHm(total),
		totalMinutesLabel: `${total} minutes`,
		latestStart,
		latestStartRel: relativeFromNow(latestStartDate),
		slackLabel: minutesToHm(slackMin),
		slackPositive: slackMin >= 0,
		countdown: `${pad(Math.floor(Math.max(0, (dep.getTime() - now.getTime()) / 1000) / 3600))}:${pad(Math.floor((Math.max(0, (dep.getTime() - now.getTime()) / 1000) % 3600) / 60))}`,
		countdownPct: pct,
		dep,
	};
};

// =============== Composants UI ===============
const SectionTitle = ({ title, badge }: { title: string; badge?: string }) => (
	<View style={styles.sectionHeader}>
		<Text style={styles.h5}>{title}</Text>
		{badge ? (
			<View style={styles.badge}>
				<Text style={styles.badgeText}>{badge}</Text>
			</View>
		) : null}
	</View>
);

const MetricCard = ({ title, main, sub, color }: { title: string; main: string; sub: string; color?: "success" | "danger" | undefined }) => (
	<View style={styles.metric}>
		<Text style={styles.metricTitle}>{title}</Text>
		<Text style={[styles.metricMain, color === "success" && { color: COLORS.success }, color === "danger" && { color: COLORS.danger }]}>{main}</Text>
		<Text style={styles.subtle}>{sub}</Text>
	</View>
);

const ProfileTabs = () => {
	const dispatch = useDispatch<AppDispatch>();
	const { manifest, key } = useActiveProfile();
	return (
		<View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
				{manifest.order.map((name) => (
					<TouchableOpacity key={name} onPress={() => dispatch(setActiveProfile(name))} style={[styles.tab, name === key && styles.tabActive]}>
						<Text style={[styles.tabText, name === key && styles.tabTextActive]} numberOfLines={1}>
							{name}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<View style={styles.tabBtns}>
				<SmallBtn label="Nouvel onglet" onPress={() => dispatch(addProfile(undefined))} />
				<SmallBtn
					label="Renommer"
					onPress={() => {
						const newName = promptLike("Nouveau nom de l’onglet :", key);
						if (newName) dispatch(renameProfile({ oldName: key, newName }));
					}}
				/>
				<SmallBtn
					label="Supprimer"
					variant="danger"
					onPress={() => {
						const ok = confirmLike(`Supprimer l’onglet « ${key} » ?`);
						if (ok) dispatch(deleteProfile({ name: key }));
					}}
				/>
			</View>
		</View>
	);
};

// Simplissimes prompts (pour Expo Go)
const promptLike = (message: string, _default?: string) => {
	// Vous pouvez brancher un vrai modal ici si besoin.
	// Pour rester single-file, on ouvre une saisie via prompt Web si dispo, sinon rien.
	// @ts-ignore
	if (typeof window !== "undefined" && window?.prompt) {
		// Expo web
		// @ts-ignore
		return window.prompt(message, _default ?? "");
	}
	return _default ?? "";
};
const confirmLike = (message: string) => {
	// @ts-ignore
	if (typeof window !== "undefined" && window?.confirm) {
		// @ts-ignore
		return window.confirm(message);
	}
	return true;
};

const SmallBtn = ({ label, onPress, variant = "default" }: { label: string; onPress: () => void; variant?: "default" | "danger" }) => (
	<TouchableOpacity onPress={onPress} style={[styles.smallBtn, variant === "danger" && styles.smallBtnDanger]}>
		<Text style={[styles.smallBtnText, variant === "danger" && { color: COLORS.danger }]}>{label}</Text>
	</TouchableOpacity>
);

const StepRow = ({ item, drag, isActive }: RenderItemParams<Step>) => {
	const dispatch = useDispatch<AppDispatch>();
	return (
		<ScaleDecorator>
			<View style={[styles.stepItem, isActive && { opacity: 0.6 }]}>
				<TouchableOpacity onLongPress={drag} style={styles.handle} accessibilityLabel="Glisser pour réordonner">
					<Text style={styles.handleText}>≡</Text>
				</TouchableOpacity>

				<TouchableOpacity onPress={() => dispatch(toggleStep({ id: item.id, enabled: !item.enabled }))} style={styles.checkbox}>
					<View style={[styles.checkboxBox, item.enabled && styles.checkboxBoxChecked]} />
				</TouchableOpacity>

				<View style={styles.nameWrap}>
					<TextInput value={item.label} onChangeText={(txt) => dispatch(updateStep({ id: item.id, patch: { label: txt || "Activité" } }))} style={styles.input} placeholder="Activité" />
				</View>

				<View style={styles.minutesWrap}>
					<View style={styles.inputGroup}>
						<TextInput
							value={String(item.minutes)}
							onChangeText={(txt) => {
								const v = Number(txt.replace(/[^\d]/g, "") || 0);
								dispatch(updateStep({ id: item.id, patch: { minutes: clamp(v, item.min ?? 0, item.max ?? 600) } }));
							}}
							keyboardType="numeric"
							style={[styles.input, { textAlign: "right" }]}
							accessibilityLabel={`Minutes pour ${item.label}`}
						/>
						<View style={styles.inputSuffix}>
							<Text style={styles.subtle}>min</Text>
						</View>
					</View>
				</View>

				<TouchableOpacity onPress={() => dispatch(deleteStep({ id: item.id }))} style={styles.delBtn}>
					<Text style={{ color: COLORS.danger }}>Supprimer</Text>
				</TouchableOpacity>
			</View>
		</ScaleDecorator>
	);
};

// =============== Écran principal ===============
const Screen = () => {
	const dispatch = useDispatch<AppDispatch>();
	const { profile } = useActiveProfile();
	const { steps, intervalToilettes, departureTime } = profile;

	const metrics = useMetrics();
	const [tick, setTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 1000);
		return () => clearInterval(id);
	}, []);

	// Progress bar largeur (recalculée via metrics.countdownPct et tick)
	const pct = metrics.countdownPct;

	// Saisie de l'heure HH:MM
	const onTimeChange = (txt: string) => {
		const v = txt.replace(/[^\d:]/g, "").slice(0, 5);
		const parts = v.split(":");
		let hh = parts[0] || "";
		let mm = parts[1] || "";
		if (hh.length > 2) {
			mm = hh.slice(2) + (mm || "");
			hh = hh.slice(0, 2);
		}
		if (mm.length > 2) mm = mm.slice(0, 2);
		const norm = [hh, mm].filter(Boolean).join(":");
		dispatch(setDepartureTime(norm));
	};

  if (!profile?.steps) return <Text>Chargement…</Text>;

  return (
		<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
			<ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
				<View style={styles.header}>
					<Text style={styles.h3}>Calculateur « Avant de partir »</Text>
					<Text style={styles.subtle}>Durées modifiables, ordre réorganisable par poignée, calculs en direct.</Text>
				</View>

				<View style={styles.card}>
					{/* Onglets de profils */}
					<ProfileTabs />

					{/* Ligne départ / compte à rebours / reset */}
					<View style={styles.row}>
						<View style={styles.col}>
							<Text style={styles.label}>Heure de départ</Text>
							<TextInput
								value={departureTime}
								onChangeText={onTimeChange}
								placeholder="08:25"
								style={[styles.input, styles.timeInput]}
								keyboardType="numbers-and-punctuation"
								maxLength={5}
							/>
						</View>
						<View style={styles.col}>
							<View style={styles.metricBox}>
								<View style={styles.spaceBetween}>
									<Text style={styles.semibold}>Départ dans</Text>
									<Text style={styles.bold}>{metrics.countdown}</Text>
								</View>
								<View style={styles.progress}>
									<View style={[styles.progressBar, { width: `${pct}%` }]} />
								</View>
							</View>
						</View>
						<View style={[styles.colAuto, { alignItems: "flex-end" }]}>
							<TouchableOpacity onPress={() => dispatch(resetProfile())} style={styles.btnOutline}>
								<Text>Réinitialiser</Text>
							</TouchableOpacity>
						</View>
					</View>

					{/* Étapes */}
					<SectionTitle title="Étapes de la routine" badge="Glisser-déposer avec la poignée" />

					<DraggableFlatList
						data={steps}
						keyExtractor={(it) => it.id}
						containerStyle={{ gap: 8 }}
						onDragEnd={({ from, to }) => dispatch(reorderSteps({ from, to }))}
						renderItem={(params) => <StepRow {...params} />}
					/>

					<View style={{ marginVertical: 12 }}>
						<TouchableOpacity onPress={() => dispatch(addStep())} style={styles.btnAdd}>
							<Text style={{ color: "#0d6efd" }}>Ajouter</Text>
						</TouchableOpacity>
					</View>

					{/* Intervalle entre Manger et Toilette 2 */}
					<View style={styles.row}>
						<View style={[styles.col, { maxWidth: 420 }]}>
							<Text style={styles.label}>Intervalle entre « Manger » et « Toilette 2 »</Text>
							<View style={styles.inputGroup}>
								<TextInput
									value={String(intervalToilettes)}
									onChangeText={(txt) => {
										const v = Number(txt.replace(/[^\d]/g, "") || 0);
										dispatch(setIntervalToilettes(clamp(v, 0, 240)));
									}}
									keyboardType="numeric"
									style={[styles.input, { textAlign: "right" }]}
								/>
								<View style={styles.inputSuffix}>
									<Text style={styles.subtle}>min</Text>
								</View>
							</View>
							<Text style={styles.formText}>
								Pris en compte dans la durée totale{" "}
								<Text style={{ fontWeight: "600", color: metrics.applies ? COLORS.success : COLORS.danger }}>
									{metrics.applies ? "(appliqué)" : "(non appliqué car ordre/état ne le permet pas)"}
								</Text>
								.
							</Text>
						</View>
					</View>

					{/* Métriques */}
					<View style={styles.metricsRow}>
						<MetricCard title="Durée totale" main={metrics.totalLabel} sub={metrics.totalMinutesLabel} />
						<MetricCard title="Début au plus tard" main={metrics.latestStart} sub={metrics.latestStartRel} />
						<MetricCard
							title="Marge"
							main={metrics.slackLabel}
							sub={metrics.slackPositive ? "Temps disponible si vous commencez maintenant." : "Retard à rattraper si vous commencez maintenant."}
							color={metrics.slackPositive ? "success" : "danger"}
						/>
					</View>

					<Text style={[styles.subtle, { textAlign: "center", marginTop: 12 }]}>
						Astuce : cochez/décochez pour inclure une étape. « Ajouter » crée une activité de 15 min. L’intervalle est ajouté seulement si « Manger » est avant « Toilette 2 ».
					</Text>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

// =============== App Root ===============

export default function App() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<Provider store={store}>
					<PersistGate persistor={persistor} loading={null}>
						<SafeAreaView style={{ flex: 1, backgroundColor: "#fff6d6" }}>
							<View style={styles.bg} />
							<Screen />
						</SafeAreaView>
					</PersistGate>
				</Provider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

// =============== Styles ===============
const styles = StyleSheet.create({
	bg: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "#fff6d6",
	},
	header: { alignItems: "center", marginVertical: 12 },
	h3: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
	h5: { fontSize: 16, fontWeight: "600", color: COLORS.text },
	subtle: { color: COLORS.subtle },
	card: {
		backgroundColor: "rgba(255,255,255,0.95)",
		borderWidth: 1,
		borderColor: COLORS.gray3,
		borderRadius: 14,
		padding: 12,
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 10,
		elevation: 2,
	},
	tabsRow: { gap: 8, paddingVertical: 4 },
	tab: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.gray3, borderRadius: 8, backgroundColor: "#fff" },
	tabActive: { backgroundColor: COLORS.gray1, borderColor: COLORS.gray3 },
	tabText: { color: "#495057", maxWidth: 180 },
	tabTextActive: { fontWeight: "700", color: COLORS.text },

	tabBtns: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 8 },
	smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: "#0d6efd", borderRadius: 8 },
	smallBtnDanger: { borderColor: COLORS.danger },
	smallBtnText: { color: "#0d6efd" },

	row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginVertical: 8 },
	col: { flexGrow: 1, flexBasis: 160 },
	colAuto: { flexBasis: 120 },

	label: { fontWeight: "600", marginBottom: 6, color: COLORS.text },
	input: { borderWidth: 1, borderColor: COLORS.gray3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#fff" },
	timeInput: { maxWidth: 120 },

	metricBox: { borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.gray3, borderRadius: 10, padding: 10, backgroundColor: COLORS.gray1 },
	semibold: { fontWeight: "600", color: COLORS.text },
	bold: { fontWeight: "700", color: COLORS.text },
	spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	progress: { height: 8, backgroundColor: COLORS.gray2, borderRadius: 6, marginTop: 8, overflow: "hidden" },
	progressBar: { height: "100%", backgroundColor: COLORS.warm2 },

	sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 6 },
	badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: COLORS.warm1 },
	badgeText: { color: "#111", fontWeight: "600" },

	stepItem: {
		backgroundColor: COLORS.gray1,
		borderWidth: 1,
		borderColor: COLORS.gray3,
		borderRadius: 10,
		padding: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	handle: { width: 32, alignItems: "center", justifyContent: "center" },
	handleText: { fontSize: 18, color: COLORS.subtle },

	checkbox: { padding: 4 },
	checkboxBox: { width: 18, height: 18, borderWidth: 1, borderColor: COLORS.gray3, borderRadius: 4, backgroundColor: "#fff" },
	checkboxBoxChecked: { backgroundColor: "#0d6efd", borderColor: "#0d6efd" },

	nameWrap: { flex: 1, minWidth: 120 },
	minutesWrap: { width: 110 },

	inputGroup: { flexDirection: "row", alignItems: "center" },
	inputSuffix: { paddingHorizontal: 8 },

	delBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 8 },

	formText: { marginTop: 6, color: COLORS.subtle },

	metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
	metric: { flexGrow: 1, flexBasis: 160, borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.gray3, borderRadius: 10, padding: 12, backgroundColor: COLORS.gray1 },
	metricTitle: { fontWeight: "600", color: COLORS.text, marginBottom: 4 },
	metricMain: { fontWeight: "700", fontSize: 18, color: COLORS.text },
});
