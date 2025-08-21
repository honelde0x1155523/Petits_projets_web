import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { recipes } from "../data/recipes";
import RecipeCard from "../components/RecipeCard";

// Typage de la recette si tu veux centraliser : tu peux le placer dans un fichier `types.ts`
type Ingredient = {
	name: string,
	amount: number,
	unit?: string,
};

type Recipe = {
	id: string,
	name: string,
	image: any,
	color: string,
	level: string,
	time: string,
	rating: number,
	longDesc: string,
	servingNb: number,
	ingredients: Ingredient[],
};

const SearchScreen: React.FC = () => {
	const recipeList = recipes.map((data: Recipe, i: number) => <RecipeCard key={i} recipe={data} />);

	return (
		<SafeAreaView style={[styles.safeArea, styles.container]}>
			<Text style={styles.title}>What do you want to eat today?</Text>
			<ScrollView>
				<View style={styles.cards}>{recipeList}</View>
			</ScrollView>
		</SafeAreaView>
	);
};

export default SearchScreen;

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
	},
	subtitle: {
		fontWeight: "500",
		color: "#C6C6C6",
		marginLeft: 20,
		marginBottom: 20,
	},
	cards: {
		flex: 1,
		flexDirection: "row",
		flexWrap: "wrap",
		padding: 10,
		alignContent: "space-between",
	},
	safeArea: {}, // ajouté pour correspondre au style utilisé dans le container
});
