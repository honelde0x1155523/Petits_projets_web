import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { FC } from "react";

import RecipeCard from "../components/RecipeCard";

// Typage de la navigation
type RootStackParamList = {
	MyRecipes: undefined,
};

type MyRecipesScreenProps = {
	navigation: NativeStackNavigationProp<RootStackParamList, "MyRecipes">,
};

// Typage du store Redux
type Recipe = {
	id: string,
	title: string,
	image: string,
	// ajoute les autres propriétés selon le modèle de recette
};

type RootState = {
	favorites: {
		value: Recipe[],
	},
};

const MyRecipesScreen: FC<MyRecipesScreenProps> = ({ navigation }) => {
	const favorites = useSelector((state: RootState) => state.favorites.value);

	const recipeList = favorites.map((data, i) => <RecipeCard key={i} recipe={data} isFavorite />);

	return (
		<SafeAreaView style={[styles.safeArea, styles.container]}>
			<Text style={styles.title}>The best ones...</Text>
			<ScrollView>
				<View style={styles.cards}>{recipeList}</View>
			</ScrollView>
		</SafeAreaView>
	);
};

export default MyRecipesScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
		paddingTop: 110,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#655074",
		marginLeft: 20,
		fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
		marginBottom: 20,
	},
	cards: {
		flex: 1,
		flexDirection: "row",
		flexWrap: "wrap",
		padding: 10,
		alignContent: "space-between",
	},
	safeArea: {}, // si tu veux l'étendre plus tard
});
