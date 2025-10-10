/* main.ts — Expo 53, React Native 0.73, TypeScript, clean code */

import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

/* ------------ Types & Constantes ------------ */

const STORAGE_KEY = "journee_recalculee";

type HM = { h: number; m: number };
type Offset = { id: string; minutes: number };

interface PersistedState {
	wake: HM;
	offsets: Offset[];
	custom: HM;
	now2: HM;
}

const BASE_WAKE_MIN = 8 * 60;
const OFFSETS_DEFAULT = [120, 300, 510, 750, 750, 870]; // +2h, +5h, +8h30, +12h30, +12h30, +14h30
const EVENTS = [
	{ id: "petitdej", label: "Petit-déjeuner" },
	{ id: "dej", label: "Déjeuner" },
	{ id: "gouter", label: "Goûter" },
	{ id: "diner", label: "Dîner" },
	{ id: "precoucher", label: "Pré-coucher" },
	{ id: "coucher", label: "Coucher" },
];

/* ------------ Helpers ------------ */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(v)));

const pad = (n: number) => String(n).padStart(2, "0");

const wrapDay = (m: number) => ((m % 1440) + 1440) % 1440;

const formatHHMM = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

const minutesBetween = (absMin: number, wakeMin: number) => absMin - wakeMin; // signé

const defaultState = (): PersistedState => {
	const now = new Date();
	return {
		wake: { h: 8, m: 0 },
		offsets: EVENTS.map((ev, i) => ({ id: ev.id, minutes: OFFSETS_DEFAULT[i] })),
		custom: { h: 12, m: 0 },
		now2: { h: now.getHours(), m: now.getMinutes() },
	};
};

/* ------------ AsyncStorage I/O ------------ */

const loadState = async (): Promise<PersistedState> => {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultState();
		const obj = JSON.parse(raw) as PersistedState;
		return {
			...defaultState(),
			...obj,
			wake: {
				h: clamp(obj.wake?.h ?? 8, 0, 23),
				m: clamp(obj.wake?.m ?? 0, 0, 59),
			},
		};
	} catch {
		return defaultState();
	}
};

const saveState = async (state: PersistedState) => {
	try {
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		Alert.alert("Erreur", "Impossible de sauvegarder les données");
	}
};

/* ------------ UI Components ------------ */

interface NumberInputProps {
	value: number;
	min: number;
	max: number;
	onChange: (n: number) => void;
}
const NumberInput = ({ value, min, max, onChange }: NumberInputProps) => (
	<TextInput style={styles.input} keyboardType="number-pad" value={String(value)} onChangeText={(t) => onChange(clamp(Number(t) || 0, min, max))} />
);

/* ------------ App ------------ */

export default function App() {
	const [state, setState] = useState<PersistedState | null>(null);

	/* charge l'état une fois */
	useEffect(() => {
		loadState().then(setState);
	}, []);

	/* persiste à chaque changement */
	useEffect(() => {
		if (state) saveState(state);
	}, [state]);

	/* dérivés */
	const wakeMin = state ? state.wake.h * 60 + state.wake.m : 0;
	const shift = wakeMin - BASE_WAKE_MIN;

	const offsetsToHM = (o: Offset) => {
		const abs = wrapDay(wakeMin + o.minutes);
		return { h: Math.floor(abs / 60), m: abs % 60 };
	};

	const updateWake = (prop: keyof HM, v: number) => setState((s) => s && { ...s, wake: { ...s.wake, [prop]: v } });

	const updateOffset = (id: string, prop: keyof HM, v: number) =>
		setState((s) => {
			if (!s) return s;
			const absHM = offsetsToHM(s.offsets.find((o) => o.id === id)!);
			const newHM = { ...absHM, [prop]: v };
			const newAbsMin = wrapDay(newHM.h * 60 + newHM.m);
			const newOffsets = s.offsets.map((o) => (o.id === id ? { ...o, minutes: wrapDay(newAbsMin - wakeMin) } : o));
			/* garder précoucher = coucher - 120 */
			if (id === "coucher") {
				const preIdx = newOffsets.findIndex((o) => o.id === "precoucher");
				if (preIdx !== -1)
					newOffsets[preIdx] = {
						...newOffsets[preIdx],
						minutes: wrapDay(newOffsets.find((o) => o.id === "coucher")!.minutes - 120),
					};
			}
			return { ...s, offsets: newOffsets };
		});

	const updateCustom = (prop: keyof HM, v: number) => setState((s) => s && { ...s, custom: { ...s.custom, [prop]: v } });

	const updateNow2 = (prop: keyof HM, v: number) => setState((s) => s && { ...s, now2: { ...s.now2, [prop]: v } });

	/* calculs */
	const computeShifted = useCallback((h: number, m: number) => formatHHMM(wrapDay(h * 60 + m - shift)), [shift]);

	if (!state) return null; // en charge

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.safe}>
				<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
					<StatusBar style="dark" />
					<ScrollView contentContainerStyle={styles.content}>
						{/* Lever */}
						<Text style={styles.title}>Heure de lever</Text>
						<View style={styles.row}>
							<NumberInput value={state.wake.h} min={0} max={23} onChange={(v) => updateWake("h", v)} />
							<Text style={styles.unit}>h</Text>
							<NumberInput value={state.wake.m} min={0} max={59} onChange={(v) => updateWake("m", v)} />
							<Text style={styles.unit}>min</Text>
						</View>

						{/* Calcul personnalisé */}
						<Text style={styles.title}>Calculer une heure recalculée</Text>
						<View style={styles.row}>
							<NumberInput value={state.custom.h} min={0} max={23} onChange={(v) => updateCustom("h", v)} />
							<Text style={styles.unit}>h</Text>
							<NumberInput value={state.custom.m} min={0} max={59} onChange={(v) => updateCustom("m", v)} />
							<Text style={styles.unit}>min&nbsp;→&nbsp;</Text>
							<Text style={styles.result}>{computeShifted(state.custom.h, state.custom.m)}</Text>
						</View>

						{/* Heure actuelle recalculée */}
						<Text style={styles.title}>Heure actuelle recalculée</Text>
						<Text style={styles.now}>{computeShifted(new Date().getHours(), new Date().getMinutes())}</Text>

						{/* Depuis l'heure actuelle → si lever = 08:00 */}
						<Text style={styles.title}>Depuis l’heure actuelle → si lever = 08:00</Text>
						<View style={styles.row}>
							<NumberInput value={state.now2.h} min={0} max={23} onChange={(v) => updateNow2("h", v)} />
							<Text style={styles.unit}>h</Text>
							<NumberInput value={state.now2.m} min={0} max={59} onChange={(v) => updateNow2("m", v)} />
							<Text style={styles.unit}>min&nbsp;→&nbsp;</Text>
							<Text style={styles.result}>{computeShifted(state.now2.h, state.now2.m)}</Text>
						</View>

						{/* Événements */}
						<Text style={styles.title}>Horaires</Text>
						{state.offsets.map((o) => {
							const hm = offsetsToHM(o);
							const offsetSigned = minutesBetween(wrapDay(hm.h * 60 + hm.m), wakeMin);
							const sign = offsetSigned >= 0 ? "+" : "-";
							const abs = Math.abs(offsetSigned);
							return (
								<View key={o.id} style={[styles.tile, styles.row]}>
									<Text style={styles.eventLabel}>{EVENTS.find((e) => e.id === o.id)!.label}</Text>
									<NumberInput value={hm.h} min={0} max={23} onChange={(v) => updateOffset(o.id, "h", v)} />
									<Text style={styles.unit}>h</Text>
									<NumberInput value={hm.m} min={0} max={59} onChange={(v) => updateOffset(o.id, "m", v)} />
									<Text style={styles.unit}>min</Text>
									<Text style={styles.offset}>{`${sign}${Math.floor(abs / 60)}h${pad(abs % 60)}`}</Text>
								</View>
							);
						})}
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

/* ------------ Styles ------------ */

const styles = StyleSheet.create({
	flex: { flex: 1 },
	safe: { flex: 1, backgroundColor: "#ff9e3d" },
	content: { padding: 16, paddingBottom: 32 },
	title: { fontWeight: "700", marginTop: 16, marginBottom: 4, color: "#8d001d" },
	row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
	unit: { fontSize: 14, color: "#666" },
	input: {
		width: 60,
		padding: 4,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 6,
		textAlign: "center",
	},
	result: { fontSize: 20, fontWeight: "700", color: "#b30026" },
	now: { fontSize: 32, fontWeight: "800", color: "#b30026", marginVertical: 4 },
	tile: {
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "rgba(0,0,0,.1)",
		borderRadius: 8,
		padding: 8,
		marginTop: 8,
	},
	eventLabel: { flexBasis: "40%", fontWeight: "600" },
	offset: { marginLeft: "auto", fontWeight: "600", color: "#b30026" },
});
