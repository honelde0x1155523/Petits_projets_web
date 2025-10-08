import React from "react";
import { SafeAreaView, View, Text, FlatList, StyleSheet, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureStore, createSlice, PayloadAction, combineReducers } from "@reduxjs/toolkit";
import { Provider, useSelector } from "react-redux";
import { persistStore, persistReducer } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";
import { SafeAreaProvider } from "react-native-safe-area-context";

// ---------- Types ----------
type BacInfo = { label: string; range: string; birthYear: number };
type EtudeInfo = { niveau: "Bac +2" | "Bac +3" | "Bac +5"; age: number; year: number };
type DecadeInfo = { age: number; birthYear: number };
type BordAnnees = { bac: BacInfo; etudes: EtudeInfo[]; decades: DecadeInfo[] };

// ---------- Data ----------
function computeData(): BordAnnees {
	const currentYear = new Date().getFullYear();
	const bacYear = currentYear - 18;
	const bac = { label: "Passent le bac cette année", range: `${bacYear} - ${bacYear}`, birthYear: bacYear };
	const etudes = [
		{ niveau: "Bac +2", age: 20, year: currentYear - 20 },
		{ niveau: "Bac +3", age: 21, year: currentYear - 21 },
		{ niveau: "Bac +5", age: 23, year: currentYear - 23 },
	];
	const decades = Array.from({ length: 20 }, (_, i) => {
		const age = (i + 1) * 5;
		return { age, birthYear: currentYear - age };
	});
	return { bac, etudes, decades };
}

// ---------- Redux Slice ----------
const bordAnneesSlice = createSlice({
	name: "bordAnnees",
	initialState: { data: computeData() as BordAnnees | null },
	reducers: {
		setData: (state, action: PayloadAction<BordAnnees>) => {
			state.data = action.payload;
		},
	},
});
const { reducer: bordAnneesReducer } = bordAnneesSlice;

// ---------- Redux Store ----------
const rootReducer = combineReducers({ bordAnnees: bordAnneesReducer });
const persistConfig = { key: "root", storage: AsyncStorage, whitelist: ["bordAnnees"] };
const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
	reducer: persistedReducer,
	middleware: (gDM) => gDM({ serializableCheck: false }),
});
const persistor = persistStore(store);

type RootState = ReturnType<typeof store.getState>;

// ---------- UI Components ----------
const Background: React.FC = () => {
	const bleuGlacier = "#eaf2ff";
	const rosePoudre = "#ffe9f2";
	const ivoireChaud = "#fff7ef";
	const orDoux = "rgba(255,210,120,0.25)";
	return (
		<View style={StyleSheet.absoluteFill}>
			<LinearGradient colors={[bleuGlacier, ivoireChaud, rosePoudre]} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={StyleSheet.absoluteFill} />
			<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
				<Defs>
					<RadialGradient id="halo1" cx="20%" cy="15%" r="60%">
						<Stop offset="0%" stopColor={orDoux} />
						<Stop offset="60%" stopColor="rgba(255,210,120,0)" />
					</RadialGradient>
					<RadialGradient id="halo2" cx="80%" cy="85%" r="55%">
						<Stop offset="0%" stopColor={orDoux} />
						<Stop offset="65%" stopColor="rgba(255,210,120,0)" />
					</RadialGradient>
				</Defs>
				<Rect x="0" y="0" width="100%" height="100%" fill="url(#halo1)" />
				<Rect x="0" y="0" width="100%" height="100%" fill="url(#halo2)" />
			</Svg>
		</View>
	);
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => <Text style={styles.h2}>{children}</Text>;

const Content = () => {
	const data = useSelector((state: RootState) => state.bordAnnees.data);
	if (!data) return <Text style={styles.text}>Chargement…</Text>;

	return (
		<View style={styles.card}>
			<Text style={styles.h1}>Indicateur des âges</Text>

			<SectionTitle>{data.bac.label}</SectionTitle>
			<Text style={styles.text}>
				Année de naissance : <Text style={styles.bold}>{data.bac.birthYear}</Text> (entre janvier et décembre {data.bac.range})
			</Text>

			<SectionTitle>Fins d'études</SectionTitle>
			{data.etudes.map((e) => (
				<Text key={e.niveau} style={styles.item}>
					{e.niveau} : {e.age} ans (nés en {e.year})
				</Text>
			))}

			<SectionTitle>Décennies et multiples de 5</SectionTitle>
			<FlatList
				data={data.decades}
				keyExtractor={(d) => String(d.age)}
				renderItem={({ item }) => (
					<Text style={styles.item}>
						{item.age} ans ({item.birthYear})
					</Text>
				)}
			/>
		</View>
	);
};

// ---------- App Root ----------
export default function App() {
	return (
		<Provider store={store}>
			<PersistGate loading={null} persistor={persistor}>
				<SafeAreaProvider>
					<SafeAreaView style={styles.safeArea}>
						<View style={styles.container}>
							<StatusBar barStyle="dark-content" />
							<Background />
							<Content />
						</View>
					</SafeAreaView>
				</SafeAreaProvider>
			</PersistGate>
		</Provider>
	);
}

// ---------- Styles ----------
const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#fff",
	},
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 30,
	},
	card: {
		width: "90%",
		maxWidth: 700,
		padding: 24,
		borderRadius: 16,
		backgroundColor: "rgba(255,255,255,0.85)",
		borderWidth: 1,
		borderColor: "rgba(200,200,200,0.5)",
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowOffset: { width: 0, height: 8 },
		shadowRadius: 20,
		elevation: 3,
		// permet le scroll interne si texte long
		maxHeight: "90%",
	},
	h1: { fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 12 },
	h2: { fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 6 },
	text: { fontSize: 16, lineHeight: 22, color: "#222" },
	item: { fontSize: 16, lineHeight: 22, color: "#222", marginVertical: 2 },
	bold: { fontWeight: "700" },
});

