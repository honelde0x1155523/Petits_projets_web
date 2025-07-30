import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus, ImageBackground, Platform, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

// === Constantes métier ===
const H_START = 8;
const H_END = 22;
const TOTAL_MINUTES = (H_END - H_START) * 60;

// === Fonctions utilitaires (pures) ===
function two(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

function clampPassedMinutes(d: Date): number {
	const passed = (d.getHours() - H_START) * 60 + d.getMinutes();
	return Math.max(0, Math.min(TOTAL_MINUTES, passed));
}

function minutesToNextHalf(d: Date): number {
	const m = d.getMinutes();
	return (m < 30 ? 30 : 60) - m;
}

function halfHourStartLabel(d: Date): string {
	const h = d.getHours();
	const m = d.getMinutes() < 30 ? 0 : 30;
	return `${two(h)}h${two(m)}`;
}

function halfHourEndLabel(d: Date): string {
	const h = d.getHours();
	return d.getMinutes() < 30 ? `${two(h)}h30` : `${two(h + 1)}h00`;
}

function minutesSinceHalfStart(d: Date): number {
	return d.getMinutes() < 30 ? d.getMinutes() : d.getMinutes() - 30;
}

interface State {
	inRange: boolean;
	nextHalfInMin: number;
	passedMin: number;
	totalMin: number;
	remainingMin: number;
	halfStart: string;
	halfEnd: string;
	sinceHalfMin: number;
}

/**
 * Calcule toutes les valeurs d'affichage à partir d'une Date.
 */
function computeState(now: Date): State {
	const inRange = now.getHours() >= H_START && now.getHours() < H_END;
	const passed = clampPassedMinutes(now);
	const remaining = TOTAL_MINUTES - passed;

	const result: State = {
		inRange,
		nextHalfInMin: minutesToNextHalf(now),
		passedMin: passed,
		totalMin: TOTAL_MINUTES,
		remainingMin: remaining,
		halfStart: halfHourStartLabel(now),
		halfEnd: halfHourEndLabel(now),
		sinceHalfMin: minutesSinceHalfStart(now),
	};

	console.log("computeState @", now.toISOString(), result);
	return result;
}

// === Hook de tick aligné sur le début de minute ===
function useMinuteClock(): Date {
	const [now, setNow] = useState<Date>(() => {
		const d = new Date();
		console.log("useMinuteClock() init:", d.toISOString());
		return d;
	});

	const intervalRef = useRef<NodeJS.Timer | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		function startIntervalAligned() {
			const d = new Date();
			const msToNextMinute = (60 - d.getSeconds()) * 1000 - d.getMilliseconds();
			console.log("startIntervalAligned: waiting", msToNextMinute, "ms");

			timeoutRef.current = setTimeout(() => {
				const tickTime = new Date();
				console.log("tick (aligned):", tickTime.toISOString());
				setNow(tickTime);

				intervalRef.current = setInterval(() => {
					const loopTick = new Date();
					console.log("tick (loop):", loopTick.toISOString());
					setNow(loopTick);
				}, 60_000);
			}, Math.max(0, msToNextMinute));
		}

		function clearTimers() {
			console.log("clearTimers");
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			if (intervalRef.current) clearInterval(intervalRef.current);
			timeoutRef.current = null;
			intervalRef.current = null;
		}

		startIntervalAligned();

		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			console.log("AppState changed:", state);
			if (state === "active") {
				clearTimers();
				const resumed = new Date();
				console.log("resuming with time:", resumed.toISOString());
				setNow(resumed);
				startIntervalAligned();
			}
		});

		return () => {
			clearTimers();
			sub?.remove?.();
		};
	}, []);

	return now;
}

// === Composant principal (main) ===
export default function App(): JSX.Element {
	const [manualNow, setManualNow] = useState<Date | null>(null);
	const now = useMinuteClock();
	const effectiveNow = manualNow || now;

	useEffect(() => {
		if (manualNow) {
			const timer = setTimeout(() => setManualNow(null), 500); // réinitialise après 0.5s
			return () => clearTimeout(timer);
		}
	}, [manualNow]);

	const vm = useMemo(() => computeState(effectiveNow), [effectiveNow]);

	// console.log("App rendu initial");
	// console.log("App render @", now.toISOString(), "inRange =", vm.inRange);

	return (
		<View style={styles.screen}>
			<ImageBackground source={require("./assets/images/petit-palmier.jpg")} resizeMode="cover" style={StyleSheet.absoluteFill}>
				<LinearGradient colors={["rgba(160,230,255,0.7)", "rgba(168,230,207,0.7)"]} style={StyleSheet.absoluteFill} />
			</ImageBackground>

			<View style={styles.card}>
				<Text style={[styles.small, styles.muted]}>
					Heure de début : <Text style={styles.strong}>08h00</Text> — Heure de fin : <Text style={styles.strong}>22h00</Text>
				</Text>

				<View style={{ height: 12 }} />

				{vm.inRange ? (
					<>
						<Text style={styles.big}>{two(vm.nextHalfInMin)} min avant demi-heure</Text>

						<View style={styles.separator} />

						<Text style={styles.small}>Demi-heures passées : {Math.floor(vm.passedMin / 30)}</Text>
						<Text style={styles.small}>
							Temps passé : {Math.floor(vm.passedMin / 60)}h{two(vm.passedMin % 60)}
						</Text>
						<Text style={styles.small}>
							Temps restant : {Math.floor(vm.remainingMin / 60)}h{two(vm.remainingMin % 60)}
						</Text>

						<View style={styles.separator} />

						<Text style={styles.small}>
							Demi-heure en cours : {vm.halfStart} à {vm.halfEnd}
						</Text>
						<Text style={styles.small}>Temps écoulé depuis le début de cette demi-heure : {vm.sinceHalfMin} min</Text>
						<Text style={styles.small}>Temps restant dans cette demi-heure : {vm.nextHalfInMin} min</Text>
					</>
				) : (
					<Text style={styles.big}>Hors plage</Text>
				)}
			</View>

			<View style={styles.refreshContainer}>
				<Text onPress={() => setManualNow(new Date())} style={styles.refreshButton}>
					Refresh
				</Text>
			</View>
			<StatusBar style={Platform.OS === "ios" ? "dark" : "auto"} />
		</View>
	);
}

// === Styles ===
const styles = StyleSheet.create({
	screen: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	card: {
		width: "90%",
		maxWidth: 400,
		backgroundColor: "rgba(255,255,255,0.6)",
		borderWidth: 5,
		borderColor: "#ff7f11",
		borderRadius: 8,
		padding: 20,
		shadowColor: "#000",
		shadowOpacity: 0.2,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 6,
	},
	big: {
		fontSize: 28,
		textAlign: "center",
	},
	small: {
		fontSize: 14,
		textAlign: "center",
	},
	strong: {
		fontWeight: "700",
	},
	muted: {
		opacity: 0.9,
	},
	separator: {
		height: 1,
		backgroundColor: "rgba(0,0,0,0.15)",
		marginVertical: 10,
	},
	refreshContainer: {
		marginTop: 20,
	},
	refreshButton: {
		backgroundColor: "#0d6efd", // Bootstrap Primary
		color: "#fff",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 4,
		fontWeight: "600",
		textAlign: "center",
		overflow: "hidden",
	},
});
