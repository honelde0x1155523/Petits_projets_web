import React, { useCallback, useEffect, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { setHour, setMinute } from "../store"; // chemin: src/store/index.js

/* Helpers --------------------------------------------------------------- */
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const two = (n) => String(n).padStart(2, "0");

export default function SleepCalculator() {
	// Lecture depuis Redux
	const hour = useSelector((s) => s.wake.hour);
	const minute = useSelector((s) => s.wake.minute);
	const dispatch = useDispatch();

	// temps restant (local uniquement)
	const [remain, setRemain] = useState({ h: 0, m: 0 });

	// parsing sécurisé
	const parsedHour = clamp(parseInt(hour, 10) || 0, 0, 23);
	const parsedMinute = clamp(parseInt(minute, 10) || 0, 0, 59);

	// calcul du temps restant
	const refresh = useCallback(() => {
		const now = new Date();
		const wake = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsedHour, parsedMinute, 0, 0);
		if (wake <= now) wake.setDate(wake.getDate() + 1);
		const diffMinutes = Math.round((wake - now) / 60000);
		setRemain({ h: Math.floor(diffMinutes / 60), m: diffMinutes % 60 });
	}, [parsedHour, parsedMinute]);

	// recalcul automatique + toutes les minutes
	useEffect(() => {
		refresh();
		const id = setInterval(refresh, 60_000);
		return () => clearInterval(id);
	}, [refresh]);

	// Couleurs selon durée restante
	const total = remain.h + remain.m / 60;
	const bg = total >= 8 ? "#198754" : total >= 6 ? "#ffc107" : total >= 3 ? "#dc3545" : "#0d0d0d";
	const fg = total < 3 ? "#ffffff" : "#000000";

	// Handlers : mise à jour Redux
	const handleHourChange = (v) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		dispatch(setHour(clean));
	};
	const handleMinuteChange = (v) => {
		const clean = v.replace(/\D/g, "").slice(0, 2);
		dispatch(setMinute(clean));
	};

	// Normalisation visuelle au blur (ajout du padding + clamp)
	const normalizeHour = () => dispatch(setHour(two(parsedHour)));
	const normalizeMinute = () => dispatch(setMinute(two(parsedMinute)));

	return (
		<ImageBackground source={require("../../assets/nuages_1.jpg")} style={styles.bg} resizeMode="cover">
			<View style={styles.center}>
				<Text style={styles.label}>Heure de réveil :</Text>

				<View style={styles.timeRow}>
					<TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={hour} onChangeText={handleHourChange} onBlur={normalizeHour} placeholder="HH" textAlign="center" />
					<Text style={styles.colon}>:</Text>
					<TextInput
						style={styles.input}
						keyboardType="numeric"
						maxLength={2}
						value={minute}
						onChangeText={handleMinuteChange}
						onBlur={normalizeMinute}
						placeholder="MM"
						textAlign="center"
					/>
				</View>

				<View style={[styles.box, { backgroundColor: bg }]}>
					<Text style={[styles.boxText, { color: fg }]}>
						{two(remain.h)}:{two(remain.m)}
					</Text>
				</View>

				<Pressable style={styles.refreshButton} onPress={refresh}>
					<Text style={styles.refreshText}>Refresh</Text>
				</Pressable>
			</View>
		</ImageBackground>
	);
}

/* Styles ---------------------------------------------------------------- */
const styles = StyleSheet.create({
	bg: { flex: 1 },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },

	label: { fontSize: 18, marginBottom: 8 },

	timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
	input: {
		width: 60,
		height: 54,
		fontSize: 24,
		textAlign: "center",
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 6,
		backgroundColor: "#fff",
		marginHorizontal: 2,
	},
	colon: { fontSize: 24, fontWeight: "bold", marginHorizontal: 4 },

	box: {
		width: 200,
		height: 200,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	boxText: { fontSize: 48, fontWeight: "bold" },
	refreshButton: {
		marginTop: 20,
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 6,
		backgroundColor: "#007bff",
	},
	refreshText: { color: "#fff", fontWeight: "bold", fontSize: 16, textAlign: "center" },
});
