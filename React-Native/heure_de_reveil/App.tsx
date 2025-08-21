import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ImageBackground, SafeAreaView, StatusBar, AppState, AppStateStatus } from "react-native";

type Times = { t8: string; t7_30: string; t6_30: string; t6: string };

// 1) Constante immuable en dehors du composant
const TIME_OFFSETS = [
	{ id: "t8", hoursAdded: 8, minutesAdded: 0 },
	{ id: "t7_30", hoursAdded: 7, minutesAdded: 30 },
	{ id: "t6_30", hoursAdded: 6, minutesAdded: 30 },
	{ id: "t6", hoursAdded: 6, minutesAdded: 0 },
] as const;

export default function App() {
	const [times, setTimes] = useState<Times>({ t8: "", t7_30: "", t6_30: "", t6: "" });
	const appStateRef = useRef<AppStateStatus>(AppState.currentState);

	const addZero = (n: number) => n.toString().padStart(2, "0");
	const formatTime = (d: Date) => `${addZero(d.getHours())}:${addZero(d.getMinutes())}`;

	// 2) Aucune dépendance variable
	const updateTimes = useCallback(() => {
		const now = new Date();
		const next: Times = { t8: "", t7_30: "", t6_30: "", t6: "" };

		TIME_OFFSETS.forEach((o) => {
			const totalMin = o.hoursAdded * 60 + o.minutesAdded;
			const later = new Date(now.getTime() + totalMin * 60 * 1000);
			next[o.id] = formatTime(later);
		});

		setTimes(next);
	}, []);

	// Au montage seulement
	useEffect(() => {
		updateTimes();
	}, [updateTimes]);

	// Au retour en premier plan uniquement
	useEffect(() => {
		const sub = AppState.addEventListener("change", (nextState) => {
			const wasBg = /inactive|background/.test(appStateRef.current ?? "");
			if (wasBg && nextState === "active") updateTimes();
			appStateRef.current = nextState;
		});
		return () => sub.remove();
	}, [updateTimes]);

	return (
		<ImageBackground source={require("./assets/nuages_1.jpg")} style={styles.background}>
			<SafeAreaView style={styles.container}>
				<StatusBar barStyle="dark-content" />
				<View style={styles.timeCard}>
					<View style={styles.cardHeader}>
						<Text style={styles.headerText}>Heure dans 8 h</Text>
					</View>
					<View style={styles.cardBody}>
						<Text style={styles.timeBig}>{times.t8}</Text>
						<View style={styles.timeRowContainer}>
							<View style={styles.timeColumn}>
								<Text style={styles.timeLabel}>+7 h 30</Text>
								<Text style={styles.timeSmall}>{times.t7_30}</Text>
							</View>
							<View style={styles.timeColumn}>
								<Text style={styles.timeLabel}>+6 h 30</Text>
								<Text style={styles.timeSmall}>{times.t6_30}</Text>
							</View>
							<View style={styles.timeColumn}>
								<Text style={styles.timeLabel}>+6 h</Text>
								<Text style={styles.timeSmall}>{times.t6}</Text>
							</View>
						</View>
						<TouchableOpacity style={styles.updateButton} onPress={updateTimes}>
							<Text style={styles.buttonText}>Actualiser</Text>
						</TouchableOpacity>
					</View>
				</View>
			</SafeAreaView>
		</ImageBackground>
	);
}

const styles = StyleSheet.create({
	background: { flex: 1, width: "100%", height: "100%" },
	container: { flex: 1, justifyContent: "center", alignItems: "center" },
	timeCard: {
		width: "90%",
		maxWidth: 540,
		backgroundColor: "rgba(255, 255, 255, 0.85)",
		borderRadius: 10,
		overflow: "hidden",
		shadowColor: "#0d6efd",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 5,
		borderWidth: 1,
		borderColor: "#0d6efd",
	},
	cardHeader: { backgroundColor: "#0d6efd", paddingVertical: 12, paddingHorizontal: 16 },
	headerText: { color: "white", textAlign: "center", fontWeight: "bold", fontSize: 18 },
	cardBody: { padding: 20, alignItems: "center" },
	timeBig: { fontSize: 48, fontWeight: "700", marginBottom: 20 },
	timeRowContainer: { flexDirection: "row", justifyContent: "space-around", width: "100%" },
	timeColumn: { alignItems: "center" },
	timeLabel: { fontWeight: "600", marginBottom: 5 },
	timeSmall: { fontSize: 20 },
	updateButton: {
		marginTop: 25,
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderWidth: 1,
		borderColor: "#0d6efd",
		borderRadius: 5,
	},
	buttonText: { color: "#0d6efd", fontWeight: "500" },
});
