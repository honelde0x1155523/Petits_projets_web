// App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, useWindowDimensions, PanResponder, GestureResponderEvent, PanResponderGestureState, Platform, Animated } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

/**
 * Portage RN du Snake "10 niveaux" + menu burger gauche + SafeArea.
 * - Grille 24x24
 * - 10 niveaux d'obstacles
 * - 5 pommes / niveau
 * - Vitesse par niveau
 * - Gestes (swipe) + D-pad
 * - Panneau HUD/contrôles dans un tiroir gauche, se cache après action
 */

type Point = { x: number; y: number };

// === Constantes & config ===
const GRID = 24;
const TARGET_PER_LEVEL = 5;
const SPEEDS = [200, 180, 165, 150, 135, 120, 105, 95, 85, 75]; // ms

// === Helpers ===
const key = (x: number, y: number) => `${x},${y}`;
const unkey = (k: string): [number, number] => k.split(",").map(Number) as [number, number];
const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID;
const clampLevelIndex = (i: number) => Math.max(0, Math.min(9, i));
const isOpposite = (a: Point, b: Point) => a.x === -b.x && a.y === -b.y;
const mulberry32 = (seed: number) => () => {
	let t = (seed += 0x6d2b79f5);
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// === Styles couleur ===
const COLORS = {
	bg: "#0f172a",
	board: "#0b1220",
	grid: "#0f1b33",
	text: "#e2e8f0",
	sub: "#94a3b8",
	obstacle: "#334155",
	snakeHead: "#22c55e",
	snakeBody: "#16a34a",
	food: "#ef4444",
	card: "#0b1220",
	cardBorder: "#1f2a44",
	badgePrimary: "#2563eb",
	badgeSuccess: "#16a34a",
	badgeSecondary: "#64748b",
	progressBg: "#0f172a",
	progressFgStart: "#22c55e",
	progressFgEnd: "#16a34a",
	btn: "#1f2a44",
	overlay: "rgba(0,0,0,0.45)",
};

// === Composant principal ===
export default function App() {
	const { width, height } = useWindowDimensions();
	const styles = useMemo(() => createStyles(width), [width]);

	// Réfs runtime
	const snakeRef = useRef<Point[]>([]);
	const dirRef = useRef<Point>({ x: 1, y: 0 });
	const nextDirRef = useRef<Point>({ x: 1, y: 0 });
	const foodRef = useRef<Point>({ x: 0, y: 0 });
	const obstaclesRef = useRef<Set<string>>(new Set());
	const levelIdxRef = useRef(0);
	const foodsEatenRef = useRef(0);
	const scoreRef = useRef(0);
	const runningRef = useRef(false);
	const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// État UI
	const [hud, setHud] = useState({ level: 1, score: 0, speed: SPEEDS[0], eaten: 0 });
	const [tick, setTick] = useState(0);
	const [levelInput, setLevelInput] = useState("1");

	// Modale fin de niveau / game over
	const [modal, setModal] = useState<{ visible: boolean; title: string; message: string; showRestart: boolean }>({
		visible: false,
		title: "",
		message: "",
		showRestart: false,
	});

	// Mise à l'échelle du plateau
	const boardSize = Math.min(width - 24, 520);
	const cell = boardSize / GRID;

	// Gestes: swipe
	const panResponder = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
			onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
				const { dx, dy } = g;
				if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
				const absX = Math.abs(dx);
				const absY = Math.abs(dy);
				const current = dirRef.current;
				let d: Point | null = null;
				if (absX > absY) d = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
				else d = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
				if (!d) return;
				if (snakeRef.current.length > 1 && isOpposite(d, current)) return;
				nextDirRef.current = d;
			},
		})
	).current;

	// === API Jeu ===
	const syncHUD = () => {
		setHud({
			level: levelIdxRef.current + 1,
			score: scoreRef.current,
			speed: SPEEDS[levelIdxRef.current] ?? 0,
			eaten: foodsEatenRef.current,
		});
	};

	const popup = (title: string, message: string, showRestart: boolean) => {
		setModal({ visible: true, title, message, showRestart });
	};

	const stopLoop = () => {
		if (loopRef.current) {
			clearInterval(loopRef.current);
			loopRef.current = null;
		}
	};

	const startLoop = () => {
		stopLoop();
		const spd = SPEEDS[levelIdxRef.current] ?? 120;
		loopRef.current = setInterval(() => {
			gameLoop();
		}, spd);
	};

	const togglePause = () => {
		if (!snakeRef.current.length) return;
		if (runningRef.current) {
			runningRef.current = false;
			stopLoop();
		} else {
			runningRef.current = true;
			startLoop();
		}
	};

	const startLevelAt = (idx: number) => {
		runningRef.current = true;
		foodsEatenRef.current = 0;
		const cx = Math.floor(GRID / 2);
		const cy = Math.floor(GRID / 2);
		snakeRef.current = [
			{ x: cx + 1, y: cy },
			{ x: cx, y: cy },
			{ x: cx - 1, y: cy },
		];
		dirRef.current = { x: 1, y: 0 };
		nextDirRef.current = { x: 1, y: 0 };
		obstaclesRef.current = buildLevel(idx);
		placeFood();
		syncHUD();
		setTick((t) => t + 1);
	};

	const startGame = (startLevel?: number) => {
		stopLoop();
		scoreRef.current = 0;
		const chosenLevel = startLevel ?? (Number(levelInput) || 1);
		levelIdxRef.current = clampLevelIndex(chosenLevel - 1);
		startLevelAt(levelIdxRef.current);
		startLoop();
	};

	const nextLevel = () => {
		if (levelIdxRef.current < 9) {
			levelIdxRef.current += 1;
			startLevelAt(levelIdxRef.current);
			popup(`Niveau ${levelIdxRef.current} terminé`, `Passage au niveau ${levelIdxRef.current + 1}.`, false);
		} else {
			runningRef.current = false;
			stopLoop();
			popup("Victoire", `Vous avez terminé les 10 niveaux. Score: ${scoreRef.current}.`, true);
		}
	};

	const gameOver = (msg: string) => {
		runningRef.current = false;
		stopLoop();
		popup("Game Over", `${msg}. Score: ${scoreRef.current}.`, true);
	};

	const placeFood = () => {
		const occupied = new Set<string>(obstaclesRef.current);
		snakeRef.current.forEach((s) => occupied.add(key(s.x, s.y)));
		const free: Point[] = [];
		for (let y = 0; y < GRID; y++) {
			for (let x = 0; x < GRID; x++) {
				const k = key(x, y);
				if (!occupied.has(k)) free.push({ x, y });
			}
		}
		if (!free.length) return gameOver("Plus de place pour la nourriture");
		foodRef.current = free[Math.floor(Math.random() * free.length)];
	};

	const gameLoop = () => {
		if (!runningRef.current) return;
		dirRef.current = nextDirRef.current;
		const head: Point = { x: snakeRef.current[0].x + dirRef.current.x, y: snakeRef.current[0].y + dirRef.current.y };

		if (!inBounds(head.x, head.y)) return gameOver("Collision avec le mur");
		if (obstaclesRef.current.has(key(head.x, head.y))) return gameOver("Collision avec un obstacle");
		for (let i = 0; i < snakeRef.current.length; i++) {
			if (snakeRef.current[i].x === head.x && snakeRef.current[i].y === head.y) return gameOver("Collision avec votre queue");
		}

		snakeRef.current.unshift(head);

		if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
			scoreRef.current += 10;
			foodsEatenRef.current += 1;
			if (foodsEatenRef.current >= TARGET_PER_LEVEL) {
				syncHUD();
				setTick((t) => t + 1);
				return nextLevel();
			}
			placeFood();
		} else {
			snakeRef.current.pop();
		}

		syncHUD();
		setTick((t) => t + 1);
	};

	// Niveaux d’obstacles
	function buildLevel(idx: number): Set<string> {
		const S = new Set<string>();
		const add = (x: number, y: number) => {
			if (inBounds(x, y)) S.add(key(x, y));
		};
		const ring = (m: number) => {
			for (let x = m; x < GRID - m; x++) {
				add(x, m);
				add(x, GRID - 1 - m);
			}
			for (let y = m; y < GRID - m; y++) {
				add(m, y);
				add(GRID - 1 - m, y);
			}
		};
		switch (idx + 1) {
			case 1:
				break;
			case 2:
				ring(5);
				for (let i = 10; i <= 13; i++) {
					S.delete(key(i, 5));
					S.delete(key(i, GRID - 1 - 5));
				}
				break;
			case 3: {
				const c = Math.floor(GRID / 2);
				for (let i = 4; i < GRID - 4; i++) {
					add(c, i);
					add(i, c);
				}
				S.delete(key(c, c));
				break;
			}
			case 4: {
				const x1 = 7,
					x2 = GRID - 8;
				for (let y = 2; y < GRID - 2; y++) {
					add(x1, y);
					add(x2, y);
				}
				for (let y = 10; y <= 13; y++) {
					S.delete(key(x1, y));
					S.delete(key(x2, y));
				}
				break;
			}
			case 5:
				for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) add(x, y);
				for (let y = GRID - 5; y <= GRID - 2; y++) for (let x = 1; x <= 4; x++) add(x, y);
				for (let y = 1; y <= 4; y++) for (let x = GRID - 5; x <= GRID - 2; x++) add(x, y);
				for (let y = GRID - 5; y <= GRID - 2; y++) for (let x = GRID - 5; x <= GRID - 2; x++) add(x, y);
				break;
			case 6:
				for (let i = 3; i < GRID - 3; i += 2) add(i, i);
				break;
			case 7:
				ring(0);
				for (let x = 10; x <= 13; x++) {
					S.delete(key(x, 0));
					S.delete(key(x, GRID - 1));
				}
				break;
			case 8:
				for (let y = 3; y < GRID; y += 4) {
					for (let x = 2; x < GRID - 2; x++) add(x, y);
					for (let x = 9; x <= 12; x++) S.delete(key(x, y));
				}
				break;
			case 9: {
				const rnd = mulberry32(42);
				let placed = 0;
				while (placed < 40) {
					const x = Math.floor(rnd() * GRID),
						y = Math.floor(rnd() * GRID);
					const center = Math.abs(x - Math.floor(GRID / 2)) + Math.abs(y - Math.floor(GRID / 2));
					if (center < 4) continue;
					add(x, y);
					placed++;
				}
				break;
			}
			case 10:
				for (let y = 2; y < GRID - 2; y += 2) {
					for (let x = 1; x < GRID - 1; x++) add(x, y);
					const gap = y % 4 === 0 ? 4 : GRID - 5;
					for (let dx = 0; dx < 3; dx++) S.delete(key(gap + dx, y));
				}
				break;
		}
		const cx = Math.floor(GRID / 2),
			cy = Math.floor(GRID / 2);
		[key(cx, cy), key(cx + 1, cy), key(cx - 1, cy), key(cx, cy + 1), key(cx, cy - 1)].forEach((k) => S.delete(k));
		return S;
	}

	// Nettoyage
	useEffect(() => {
		return () => stopLoop();
	}, []);

	// Ensembles pour lookup O(1)
	const snakeSet = useMemo(() => new Set(snakeRef.current.map((s) => key(s.x, s.y))), [tick]);
	const headKey = useMemo(() => (snakeRef.current[0] ? key(snakeRef.current[0].x, snakeRef.current[0].y) : ""), [tick]);

	// Rendu cellule
	const renderCell = (x: number, y: number) => {
		const k = key(x, y);
		let bg = COLORS.board;
		if (obstaclesRef.current.has(k)) bg = COLORS.obstacle;
		if (k === key(foodRef.current.x, foodRef.current.y)) bg = COLORS.food;
		if (snakeSet.has(k)) bg = k === headKey ? COLORS.snakeHead : COLORS.snakeBody;
		return (
			<View
				key={k}
				style={{
					width: cell,
					height: cell,
					backgroundColor: bg,
					borderRightWidth: 0.5,
					borderBottomWidth: 0.5,
					borderColor: COLORS.grid,
				}}
			/>
		);
	};

	// Direction via D-pad
	const applyDir = (d: Point) => {
		const current = dirRef.current;
		if (snakeRef.current.length > 1 && isOpposite(d, current)) return;
		nextDirRef.current = d;
	};

	// === Menu burger (tiroir) ===
	const [menuOpen, setMenuOpen] = useState(false);
	const drawerWidth = Math.min(width * 0.82, 420);
	const drawerTranslate = useRef(new Animated.Value(-drawerWidth)).current;

	const openMenu = () => {
		setMenuOpen(true);
		Animated.timing(drawerTranslate, { toValue: 0, duration: 220, useNativeDriver: true }).start();
	};
	const closeMenu = () => {
		Animated.timing(drawerTranslate, { toValue: -drawerWidth, duration: 220, useNativeDriver: true }).start(() => setMenuOpen(false));
	};
	const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());
	const withAutoClose = (fn: () => void) => () => {
		fn();
		closeMenu();
	};
	useEffect(() => {
		if (!menuOpen) drawerTranslate.setValue(-drawerWidth);
	}, [drawerWidth, menuOpen, drawerTranslate]);

	// === UI ===
	return (
		<SafeAreaProvider>
			<SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]} edges={["top", "left", "right"]}>
				<StatusBar style="light" />

				{/* Bouton burger */}
				<View style={styles.burgerWrap}>
					<Pressable onPress={toggleMenu} style={styles.burgerBtn} accessibilityRole="button" accessibilityLabel="Ouvrir le menu">
						<View style={styles.burgerBar} />
						<View style={styles.burgerBar} />
						<View style={styles.burgerBar} />
					</Pressable>
				</View>

				{/* Contenu principal: plateau + d-pad */}
				<View style={styles.container}>
					<View style={styles.left}>
						<View style={{ width: boardSize, aspectRatio: 1, backgroundColor: COLORS.board }} {...panResponder.panHandlers}>
							<View style={{ flexDirection: "row", flexWrap: "wrap" }}>{Array.from({ length: GRID * GRID }).map((_, i) => renderCell(i % GRID, Math.floor(i / GRID)))}</View>
						</View>
						<Text style={styles.legend}>Gestes: swipe. D-pad ci-dessous. 5 pommes par niveau.</Text>
						<View style={[styles.dpadRow]}>
							<Pressable style={styles.dpadBtn} onPress={() => applyDir({ x: 0, y: -1 })}>
								<Text style={styles.btnTxt}>↑</Text>
							</Pressable>
						</View>
						<View style={[styles.dpadRow, { justifyContent: "center" }]}>
							<Pressable style={styles.dpadBtn} onPress={() => applyDir({ x: -1, y: 0 })}>
								<Text style={styles.btnTxt}>←</Text>
							</Pressable>
							<Pressable style={styles.dpadBtn} onPress={() => applyDir({ x: 0, y: 1 })}>
								<Text style={styles.btnTxt}>↓</Text>
							</Pressable>
							<Pressable style={styles.dpadBtn} onPress={() => applyDir({ x: 1, y: 0 })}>
								<Text style={styles.btnTxt}>→</Text>
							</Pressable>
						</View>
					</View>
				</View>

				{/* Overlay pour fermer le menu */}
				{menuOpen && <Pressable style={styles.overlay} onPress={closeMenu} accessibilityLabel="Fermer le menu" />}

				{/* Tiroir gauche */}
				<Animated.View
					style={[
						styles.drawer,
						{
							width: drawerWidth,
							transform: [{ translateX: drawerTranslate }],
						},
					]}
					accessibilityViewIsModal
				>
					<SafeAreaView style={styles.drawerSafe} edges={["bottom"]}>
						<View style={styles.card}>
							<View style={styles.cardBody}>
								<View style={styles.hudRow}>
									<View style={[styles.badge, { backgroundColor: COLORS.badgePrimary }]}>
										<Text style={styles.badgeTxt}>Niveau {hud.level}/10</Text>
									</View>
									<View style={[styles.badge, { backgroundColor: COLORS.badgeSuccess }]}>
										<Text style={styles.badgeTxt}>Score {hud.score}</Text>
									</View>
									<View style={[styles.badge, { backgroundColor: COLORS.badgeSecondary }]}>
										<Text style={styles.badgeTxt}>Vitesse {hud.speed}ms</Text>
									</View>
								</View>

								<Text style={styles.text}>
									Objectif niveau: <Text style={styles.bold}>{TARGET_PER_LEVEL}</Text> pommes
								</Text>
								<View style={styles.progress}>
									<View style={[styles.progressBar, { width: `${Math.round((hud.eaten / TARGET_PER_LEVEL) * 100)}%` }]} />
								</View>

								<View style={styles.row}>
									<View style={{ flex: 1 }}>
										<Text style={[styles.label]}>Choisir le niveau (1–10)</Text>
										<TextInput
											value={levelInput}
											onChangeText={setLevelInput}
											keyboardType={Platform.select({ ios: "number-pad", android: "numeric" })}
											placeholder="1"
											placeholderTextColor={COLORS.sub}
											style={styles.input}
										/>
									</View>
									<Pressable
										style={[styles.btn, styles.btnOutlinePrimary]}
										onPress={withAutoClose(() => {
											const desired = clampLevelIndex((parseInt(levelInput || "1", 10) || 1) - 1);
											stopLoop();
											scoreRef.current = 0;
											levelIdxRef.current = desired;
											startLevelAt(levelIdxRef.current);
											startLoop();
										})}
									>
										<Text style={styles.btnTxt}>Aller</Text>
									</Pressable>
								</View>

								<View style={styles.btnRow}>
									<Pressable style={[styles.btn, styles.btnSuccess]} onPress={withAutoClose(() => startGame())}>
										<Text style={styles.btnTxt}>Démarrer</Text>
									</Pressable>
									<Pressable style={[styles.btn, styles.btnWarn]} onPress={withAutoClose(() => runningRef.current && togglePause())}>
										<Text style={styles.btnTxt}>Pause</Text>
									</Pressable>
									<Pressable style={[styles.btn, styles.btnInfo]} onPress={withAutoClose(() => !runningRef.current && togglePause())}>
										<Text style={styles.btnTxt}>Reprendre</Text>
									</Pressable>
									<Pressable style={[styles.btn, styles.btnLight]} onPress={withAutoClose(() => startGame(1))}>
										<Text style={styles.btnTxt}>Recommencer</Text>
									</Pressable>
								</View>

								<Text style={[styles.text, { marginTop: 8, marginBottom: 4 }]}>Niveaux</Text>
								<Text style={styles.legend}>
									1: libre • 2: anneau central • 3: croix • 4: doubles murs • 5: coins • 6: diagonale • 7: clôture • 8: barres • 9: blocs • 10: labyrinthe
								</Text>
							</View>
						</View>
					</SafeAreaView>
				</Animated.View>

				{/* Modale fin */}
				<Modal transparent animationType="fade" visible={modal.visible} onRequestClose={() => setModal((m) => ({ ...m, visible: false }))}>
					<View style={styles.modalWrap}>
						<View style={styles.modalCard}>
							<Text style={[styles.title]}>{modal.title}</Text>
							<Text style={[styles.text, { marginTop: 8 }]}>{modal.message}</Text>
							<View style={[styles.btnRow, { marginTop: 16 }]}>
								{!modal.showRestart && (
									<Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => setModal((m) => ({ ...m, visible: false }))}>
										<Text style={styles.btnTxt}>Continuer</Text>
									</Pressable>
								)}
								{modal.showRestart && (
									<Pressable
										style={[styles.btn, styles.btnLight]}
										onPress={() => {
											setModal((m) => ({ ...m, visible: false }));
											startGame(1);
										}}
									>
										<Text style={styles.btnTxt}>Recommencer</Text>
									</Pressable>
								)}
							</View>
						</View>
					</View>
				</Modal>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

// === Styles ===
const createStyles = (screenWidth: number) => {
	const isSmall = screenWidth < 380; // Galaxy A5 et petits écrans
	const isMedium = screenWidth >= 380 && screenWidth < 600;

	// Échelles typographiques
	const fs12 = isSmall ? 11 : 12;
	const fs13 = isSmall ? 12 : 13;
	const fs14 = isSmall ? 13 : 14;
	const fs18 = isSmall ? 16 : 18;

	// Boutons (taille relative + carrés)
	const dpadSizePct = isSmall ? "22%" : isMedium ? "18%" : "14%";

	// Carte/espacements relatifs
	const pad = isSmall ? 10 : 12;
	const gap = isSmall ? 8 : 12;

	return StyleSheet.create({
		safe: { flex: 1 },
		container: {
			flex: 1,
			paddingTop: 8,
			paddingHorizontal: pad,
			paddingBottom: 12,
			justifyContent: "flex-start",
			alignItems: "center",
		},

		// Plateau
		left: {
			width: "100%",
			alignItems: "center",
		},

		legend: { color: COLORS.sub, fontSize: fs12, marginTop: 8, textAlign: "center" },

		// Carte HUD (dans le tiroir)
		card: {
			backgroundColor: COLORS.card,
			borderWidth: 1,
			borderColor: COLORS.cardBorder,
			borderRadius: 10,
			width: "100%",
		},
		cardBody: { padding: pad },

		hudRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			marginBottom: 8,
			flexWrap: "wrap",
			rowGap: 6,
		},
		badge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, marginRight: 6, marginBottom: 6 },
		badgeTxt: { color: "#fff", fontWeight: "600", fontSize: fs13 },

		text: { color: COLORS.text, fontSize: fs14 },
		bold: { fontWeight: "700" },

		row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
		label: { color: COLORS.sub, fontSize: fs12, marginBottom: 4 },

		input: {
			backgroundColor: "#0e1527",
			borderColor: "#23304f",
			borderWidth: 1,
			borderRadius: 6,
			paddingHorizontal: 10,
			paddingVertical: 8,
			color: COLORS.text,
			width: "100%",
			minHeight: 40,
		},

		btnRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: 8,
			marginVertical: 12,
		},
		btn: {
			paddingHorizontal: 12,
			paddingVertical: 10,
			borderRadius: 8,
			backgroundColor: COLORS.btn,
			alignItems: "center",
			flexGrow: 1,
			flexBasis: isSmall ? "48%" : "auto",
			minWidth: isSmall ? undefined : 110,
		},
		btnTxt: { color: "#fff", fontWeight: "700", fontSize: fs13 },

		btnOutlinePrimary: { borderWidth: 1, borderColor: "#2563eb", backgroundColor: "transparent" },
		btnPrimary: { backgroundColor: "#2563eb" },
		btnSuccess: { backgroundColor: "#16a34a" },
		btnWarn: { backgroundColor: "#f59e0b" },
		btnInfo: { backgroundColor: "#0ea5e9" },
		btnLight: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#e5e7eb" },

		progress: {
			height: isSmall ? 8 : 10,
			backgroundColor: COLORS.progressBg,
			borderRadius: 6,
			overflow: "hidden",
			marginTop: 6,
			width: "100%",
		},
		progressBar: { height: "100%", backgroundColor: COLORS.progressFgStart },

		// D-pad
		dpadRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 8, width: "100%" },
		dpadBtn: {
			width: dpadSizePct,
			aspectRatio: 1,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: "#3a4a6e",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: "#0e1527",
		},

		// Burger
		burgerWrap: {
			position: "absolute",
			top: 8,
			left: 8,
			zIndex: 50,
		},
		burgerBtn: {
			width: 44,
			height: 44,
			borderRadius: 8,
			backgroundColor: "#0e1527",
			borderWidth: 1,
			borderColor: "#26334f",
			alignItems: "center",
			justifyContent: "center",
			paddingVertical: 8,
			paddingHorizontal: 8,
		},
		burgerBar: {
			width: "100%",
			height: 3,
			backgroundColor: "#e5e7eb",
			marginVertical: 2,
			borderRadius: 2,
		},

		// Tiroir et overlay
		overlay: {
			position: "absolute",
			top: 0,
			bottom: 0,
			left: 0,
			right: 0,
			backgroundColor: COLORS.overlay,
			zIndex: 40,
		},
		drawer: {
			position: "absolute",
			top: 0,
			bottom: 0,
			left: 0,
			backgroundColor: COLORS.bg,
			paddingHorizontal: 12,
			paddingTop: 12,
			paddingBottom: 16,
			zIndex: 60,
			borderRightWidth: 1,
			borderRightColor: COLORS.cardBorder,
		},
		drawerSafe: {
			flex: 1,
			justifyContent: "flex-start",
		},

		// Modale
		modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
		modalCard: {
			backgroundColor: COLORS.card,
			borderRadius: 12,
			padding: 16,
			borderWidth: 1,
			borderColor: COLORS.cardBorder,
			width: "92%",
			maxWidth: 480,
		},
		title: { color: COLORS.text, fontWeight: "700", fontSize: fs18, textAlign: "left" },
	});
};
