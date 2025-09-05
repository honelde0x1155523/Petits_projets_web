import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { todayKey, fmtHMS, parseHMS } from "./src/lib/time";
import { loadAll, saveAll } from "./src/lib/storage";
import { Cadre, CadreDTO, DayData, createCadre, reviveCadre } from "./src/types";

export default function App() {
	const [days, setDays] = useState<Record<string, CadreDTO[]>>({});
	const [cadres, setCadres] = useState<Cadre[]>([]);
	const [historyOpen, setHistoryOpen] = useState(false);

	// Ajout: état pour la modale "Ajouter un cadre"
	const [addState, setAddState] = useState<{ open: boolean; name: string }>({ open: false, name: "" });

	const [renameState, setRenameState] = useState<{ id?: string; name: string }>({ name: "" });
	const [resetState, setResetState] = useState<{ id?: string; value: string }>({ value: "00:00:00" });
	const tickRef = useRef<NodeJS.Timer | null>(null);
	const dayKey = useMemo(() => todayKey(), []);

	useEffect(() => {
		(async () => {
			const data = await loadAll();
			const list = (data[dayKey] ?? defaultCadres()).map(reviveCadre);
			setDays(data);
			setCadres(list);
			startTick();
		})();
		return stopTick;
	}, []);

	const startTick = () => {
		stopTick();
		tickRef.current = setInterval(() => setCadres((prev) => [...prev]), 1000);
	};
	const stopTick = () => {
		if (tickRef.current) clearInterval(tickRef.current);
		tickRef.current = null;
	};

	const persist = useCallback(
		async (nextCadres: Cadre[]) => {
			const nextDays = { ...days, [dayKey]: nextCadres };
			setDays(nextDays);
			await saveAll(nextDays);
		},
		[days, dayKey]
	);

	const onStart = (id: string) => {
		setCadres((list) => {
			const next = list.map((c) => (c.id === id ? { ...c, enCours: true, debut: Date.now() } : c));
			void persist(next);
			return next;
		});
	};

	const onPause = (id: string) => {
		setCadres((list) => {
			const next = list.map((c) => {
				if (c.id !== id || !c.enCours) return c;
				const delta = Date.now() - (c.debut ?? Date.now());
				return { ...c, enCours: false, totalMs: c.totalMs + delta, debut: null };
			});
			void persist(next);
			return next;
		});
	};

	const onResetAsk = (id: string) => setResetState({ id, value: "00:00:00" });
	const onResetConfirm = () => {
		if (!resetState.id) return;
		const ms = parseHMS(resetState.value);
		setCadres((list) => {
			const next = list.map((c) => (c.id === resetState.id ? { ...c, enCours: false, debut: null, totalMs: ms } : c));
			void persist(next);
			return next;
		});
		setResetState({ id: undefined, value: "00:00:00" });
	};

	const onRenameAsk = (id: string, current: string) => setRenameState({ id, name: current });
	const onRenameConfirm = () => {
		if (!renameState.id || !renameState.name.trim()) return;
		setCadres((list) => {
			const next = list.map((c) => (c.id === renameState.id ? { ...c, nom: renameState.name.trim() } : c));
			void persist(next);
			return next;
		});
		setRenameState({ id: undefined, name: "" });
	};

	const onDelete = (id: string) => {
		Alert.alert("Supprimer", "Supprimer définitivement ce cadre ?", [
			{ text: "Annuler", style: "cancel" },
			{
				text: "Supprimer",
				style: "destructive",
				onPress: () => {
					setCadres((list) => {
						const next = list.filter((c) => c.id !== id);
						void persist(next);
						return next;
					});
				},
			},
		]);
	};

	// Remplacement: ouverture d’une vraie modale “Ajouter un cadre”
	const onAddOpen = () => setAddState({ open: true, name: "" });
	const onAddConfirm = () => {
		const name = addState.name.trim();
		if (!name) return;
		setCadres((list) => {
			const c = createCadre(name);
			const next = [...list, c];
			void persist(next);
			return next;
		});
		setAddState({ open: false, name: "" });
	};

	const onEndDay = () => {
		setCadres((list) => {
			const paused = list.map((c) => {
				if (!c.enCours) return c;
				const delta = Date.now() - (c.debut ?? Date.now());
				return { ...c, enCours: false, totalMs: c.totalMs + delta, debut: null };
			});
			void persist(paused);
			Alert.alert("Fin de journée", "Journée enregistrée.");
			return paused;
		});
	};

	const totalToday = useMemo(() => {
		return cadres.reduce((s, c) => s + c.totalMs + (c.enCours && c.debut ? Date.now() - c.debut : 0), 0);
	}, [cadres]);

	const sortedHistoryKeys = useMemo(() => {
		const keys = Object.keys(days);
		return keys.sort((a, b) => {
			const [da, ma, ya] = a.split("-").map(Number);
			const [db, mb, yb] = b.split("-").map(Number);
			return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
		});
	}, [days]);

	const onEraseDay = (key: string) => {
		Alert.alert("Effacer", `Effacer la journée ${key} ?`, [
			{ text: "Annuler", style: "cancel" },
			{
				text: "Effacer",
				style: "destructive",
				onPress: async () => {
					const next = { ...days };
					delete next[key];
					setDays(next);
					await saveAll(next);
				},
			},
		]);
	};

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
				<StatusBar barStyle="light-content" />

				<View style={styles.navbar}>
					<TouchableOpacity style={styles.burger} onPress={() => setHistoryOpen(true)}>
						<Ionicons name="menu" size={20} color="#0b1e35" />
					</TouchableOpacity>
					<Text style={styles.brand}>Suivi d’activité</Text>
				</View>

				<FlatList
					contentContainerStyle={styles.listContent}
					data={cadres}
					keyExtractor={(c) => c.id}
					renderItem={({ item }) => (
						<CadreCard
							cadre={item}
							onStart={() => onStart(item.id)}
							onPause={() => onPause(item.id)}
							onReset={() => onResetAsk(item.id)}
							onRename={() => onRenameAsk(item.id, item.nom)}
							onDelete={() => onDelete(item.id)}
						/>
					)}
					ListFooterComponent={
						<View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
							<Pressable style={[styles.btn, styles.btnPrimary]} onPress={onAddOpen}>
								<Text style={styles.btnText}>Ajouter un cadre</Text>
							</Pressable>
							<Pressable style={[styles.btn, styles.btnDanger]} onPress={onEndDay}>
								<Text style={styles.btnText}>Fin de journée</Text>
							</Pressable>
							<Text style={styles.total}>Total aujourd’hui: {fmtHMS(totalToday)}</Text>
						</View>
					}
				/>

				{/* Modale Historique */}
				<Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
					<SafeAreaView style={styles.historyRoot}>
						<View style={styles.historyHeader}>
							<Text style={styles.historyTitle}>Historique</Text>
							<TouchableOpacity onPress={() => setHistoryOpen(false)}>
								<Ionicons name="close" size={24} color="#e9ecef" />
							</TouchableOpacity>
						</View>
						<FlatList
							contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
							data={sortedHistoryKeys}
							keyExtractor={(k) => k}
							renderItem={({ item: k }) => {
								const list = (days[k] ?? []).map(reviveCadre);
								const total = list.reduce((s, c) => s + c.totalMs, 0);
								return (
									<View style={styles.historyDay}>
										<View style={styles.historyDayHeader}>
											<Text style={styles.historyDayTitle}>{k}</Text>
											<TouchableOpacity style={styles.chipDanger} onPress={() => onEraseDay(k)}>
												<Text style={styles.chipDangerText}>Effacer</Text>
											</TouchableOpacity>
										</View>
										<View style={styles.historyList}>
											{list.map((c) => (
												<View key={c.id} style={styles.historyItem}>
													<Text style={styles.historyItemName}>{c.nom}</Text>
													<Text style={styles.historyItemTime}>{fmtHMS(c.totalMs)}</Text>
												</View>
											))}
											<View style={[styles.historyItem, { borderTopWidth: 1, borderTopColor: "#264d73", marginTop: 8, paddingTop: 8 }]}>
												<Text style={[styles.historyItemName, { fontWeight: "700" }]}>Total</Text>
												<Text style={[styles.historyItemTime, { fontWeight: "700" }]}>{fmtHMS(total)}</Text>
											</View>
										</View>
									</View>
								);
							}}
						/>
					</SafeAreaView>
				</Modal>

				{/* Modale Ajouter un cadre */}
				<Modal transparent visible={addState.open} animationType="fade" onRequestClose={() => setAddState({ open: false, name: "" })}>
					<View style={styles.overlay}>
						<View style={styles.dialog}>
							<Text style={styles.dialogTitle}>Nouveau cadre</Text>
							<TextInput
								value={addState.name}
								onChangeText={(t) => setAddState((s) => ({ ...s, name: t }))}
								style={styles.input}
								placeholder="Nom du cadre"
								placeholderTextColor="#9aa7b3"
								autoCapitalize="sentences"
							/>
							<View style={styles.row}>
								<Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => setAddState({ open: false, name: "" })}>
									<Text style={styles.btnTextDark}>Annuler</Text>
								</Pressable>
								<Pressable style={[styles.btn, styles.btnPrimary]} onPress={onAddConfirm}>
									<Text style={styles.btnText}>Ajouter</Text>
								</Pressable>
							</View>
						</View>
					</View>
				</Modal>

				{/* Modale Renommer */}
				<Modal transparent visible={!!renameState.id} animationType="fade" onRequestClose={() => setRenameState({ id: undefined, name: "" })}>
					<View style={styles.overlay}>
						<View style={styles.dialog}>
							<Text style={styles.dialogTitle}>Modifier nom</Text>
							<TextInput
								value={renameState.name}
								onChangeText={(t) => setRenameState((s) => ({ ...s, name: t }))}
								style={styles.input}
								placeholder="Nouveau nom"
								placeholderTextColor="#9aa7b3"
							/>
							<View style={styles.row}>
								<Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => setRenameState({ id: undefined, name: "" })}>
									<Text style={styles.btnTextDark}>Annuler</Text>
								</Pressable>
								<Pressable style={[styles.btn, styles.btnPrimary]} onPress={onRenameConfirm}>
									<Text style={styles.btnText}>Valider</Text>
								</Pressable>
							</View>
						</View>
					</View>
				</Modal>

				{/* Modale Reset */}
				<Modal transparent visible={!!resetState.id} animationType="fade" onRequestClose={() => setResetState({ id: undefined, value: "00:00:00" })}>
					<View style={styles.overlay}>
						<View style={styles.dialog}>
							<Text style={styles.dialogTitle}>Réinitialiser (HH:MM:SS)</Text>
							<TextInput
								value={resetState.value}
								onChangeText={(t) => setResetState((s) => ({ ...s, value: t }))}
								style={styles.input}
								placeholder="00:00:00"
								placeholderTextColor="#9aa7b3"
								autoCapitalize="none"
							/>
							<View style={styles.row}>
								<Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => setResetState({ id: undefined, value: "00:00:00" })}>
									<Text style={styles.btnTextDark}>Annuler</Text>
								</Pressable>
								<Pressable style={[styles.btn, styles.btnWarning]} onPress={onResetConfirm}>
									<Text style={styles.btnText}>Réinitialiser</Text>
								</Pressable>
							</View>
						</View>
					</View>
				</Modal>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

function CadreCard({
	cadre,
	onStart,
	onPause,
	onReset,
	onRename,
	onDelete,
}: {
	cadre: Cadre;
	onStart: () => void;
	onPause: () => void;
	onReset: () => void;
	onRename: () => void;
	onDelete: () => void;
}) {
	const elapsed = cadre.totalMs + (cadre.enCours && cadre.debut ? Date.now() - cadre.debut : 0);
	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				<Text style={styles.cardTitle}>{cadre.nom}</Text>
				<TouchableOpacity style={styles.closeBtn} onPress={onDelete} accessibilityLabel="Supprimer">
					<Ionicons name="close" size={16} color="#0b1e35" />
				</TouchableOpacity>
			</View>
			<Text style={styles.timer}>{fmtHMS(elapsed)}</Text>
			<View style={styles.actions}>
				<Pressable style={[styles.btn, styles.btnSuccess]} onPress={onStart}>
					<Text style={styles.btnText}>Start</Text>
				</Pressable>
				<Pressable style={[styles.btn, styles.btnWarning]} onPress={onPause}>
					<Text style={styles.btnText}>Pause</Text>
				</Pressable>
				<Pressable style={[styles.btn, styles.btnSecondary]} onPress={onReset}>
					<Text style={styles.btnTextDark}>Réinitialiser</Text>
				</Pressable>
				<Pressable style={[styles.btn, styles.btnOutline]} onPress={onRename}>
					<Text style={styles.btnOutlineText}>Modifier nom</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: "#0b1e35" },
	navbar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#264d73",
		backgroundColor: "#11264d",
	},
	burger: {
		backgroundColor: "#ffffff",
		width: 34,
		height: 34,
		borderRadius: 17,
		alignItems: "center",
		justifyContent: "center",
	},
	brand: { color: "#e9ecef", marginLeft: 10, fontSize: 16, fontWeight: "600" },
	listContent: { padding: 16, paddingBottom: 8 },
	card: {
		backgroundColor: "#13294b",
		borderWidth: 1,
		borderColor: "#264d73",
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
	},
	cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
	cardTitle: { color: "#e9ecef", fontSize: 16, fontWeight: "600" },
	closeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
	timer: { color: "#9ec5fe", fontSize: 20, fontWeight: "500", marginVertical: 8 },
	actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
	btn: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
	btnText: { color: "#0b1e35", fontWeight: "600" },
	btnTextDark: { color: "#0b1e35", fontWeight: "600" },
	btnPrimary: { backgroundColor: "#0d6efd" },
	btnDanger: { backgroundColor: "#dc3545" },
	btnSuccess: { backgroundColor: "#198754" },
	btnWarning: { backgroundColor: "#ffc107" },
	btnSecondary: { backgroundColor: "#d0d6db" },
	btnOutline: { borderWidth: 1, borderColor: "#6c757d", backgroundColor: "transparent" },
	btnOutlineText: { color: "#d0d6db", fontWeight: "600" },
	total: { color: "#e9ecef", textAlign: "center", marginTop: 8 },
	historyRoot: { flex: 1, backgroundColor: "#0b1e35" },
	historyHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#11264d",
		borderBottomWidth: 1,
		borderBottomColor: "#264d73",
	},
	historyTitle: { color: "#e9ecef", fontSize: 18, fontWeight: "600" },
	historyDay: { backgroundColor: "#13294b", borderRadius: 8, borderWidth: 1, borderColor: "#264d73", padding: 12, marginBottom: 12 },
	historyDayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
	historyDayTitle: { color: "#e9ecef", fontWeight: "600" },
	chipDanger: { borderWidth: 1, borderColor: "#dc3545", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
	chipDangerText: { color: "#dc3545", fontWeight: "600" },
	historyList: { gap: 6 },
	historyItem: { flexDirection: "row", justifyContent: "space-between" },
	historyItemName: { color: "#e9ecef" },
	historyItemTime: { color: "#e9ecef" },
	overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
	dialog: { width: "100%", maxWidth: 420, backgroundColor: "#13294b", borderWidth: 1, borderColor: "#264d73", borderRadius: 8, padding: 16 },
	dialogTitle: { color: "#e9ecef", fontWeight: "700", marginBottom: 8 },
	input: {
		backgroundColor: "#0b1e35",
		color: "#e9ecef",
		borderWidth: 1,
		borderColor: "#264d73",
		borderRadius: 6,
		paddingHorizontal: 10,
		paddingVertical: 8,
		marginBottom: 12,
	},
	row: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});

function defaultCadres(): Cadre[] {
	return [createCadre("Heures travaillées"), createCadre("Pause nourriture"), createCadre("Pause inspiration"), createCadre("Pause toilettes")];
}
