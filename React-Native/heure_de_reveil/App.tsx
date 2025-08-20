import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ImageBackground, SafeAreaView, StatusBar } from "react-native";

export default function App() {
	// State pour stocker les heures calculées
	const [times, setTimes] = useState({
		t8: "",
		t7_30: "",
		t6_30: "",
		t6: "",
	});

	// Décalages à appliquer pour chaque zone d'affichage
	const timeOffsets = [
		{ id: "t8", hoursAdded: 8, minutesAdded: 0 },
		{ id: "t7_30", hoursAdded: 7, minutesAdded: 30 },
		{ id: "t6_30", hoursAdded: 6, minutesAdded: 30 },
		{ id: "t6", hoursAdded: 6, minutesAdded: 0 },
	];

	// Ajoute un zéro devant les nombres < 10
	const addZero = (number: number): string => number.toString().padStart(2, "0");

	// Formate une instance Date en HH:MM
	const formatTime = (date: Date): string => `${addZero(date.getHours())}:${addZero(date.getMinutes())}`;

	// Calcule et met à jour toutes les heures décalées
	const updateTimes = () => {
		const currentDate = new Date();
		const newTimes = { ...times };

		timeOffsets.forEach((offset) => {
			const totalMinutes = offset.hoursAdded * 60 + offset.minutesAdded;
			const laterDate = new Date(currentDate.getTime() + totalMinutes * 60 * 1000);
			newTimes[offset.id as keyof typeof times] = formatTime(laterDate);
		});

		setTimes(newTimes);
	};

	// Effet pour initialiser les heures uniquement au chargement initial
	useEffect(() => {
		updateTimes();
		// Pas d'intervalle de mise à jour automatique
	}, []);

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
	background: {
		flex: 1,
		width: "100%",
		height: "100%",
	},
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
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
	cardHeader: {
		backgroundColor: "#0d6efd",
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	headerText: {
		color: "white",
		textAlign: "center",
		fontWeight: "bold",
		fontSize: 18,
	},
	cardBody: {
		padding: 20,
		alignItems: "center",
	},
	timeBig: {
		fontSize: 48,
		fontWeight: "700",
		marginBottom: 20,
	},
	timeRowContainer: {
		flexDirection: "row",
		justifyContent: "space-around",
		width: "100%",
	},
	timeColumn: {
		alignItems: "center",
	},
	timeLabel: {
		fontWeight: "600",
		marginBottom: 5,
	},
	timeSmall: {
		fontSize: 20,
	},
	updateButton: {
		marginTop: 25,
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderWidth: 1,
		borderColor: "#0d6efd",
		borderRadius: 5,
	},
	buttonText: {
		color: "#0d6efd",
		fontWeight: "500",
	},
});
