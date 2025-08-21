import React, { useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "react-native-vector-icons/Ionicons";
import { favorite, unfavorite, updateServings } from "../reducers/favorites";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { FC } from "react";

// Typage de la recette
type Ingredient = {
	name: string,
	amount: number,
	unit?: string,
};

type Recipe = {
	id: string,
	name: string,
	image: any, // à adapter si besoin
	color: string,
	level: string,
	time: string,
	rating: number,
	longDesc: string,
	servingNb: number,
	ingredients: Ingredient[],
};

// Typage du store
type RootState = {
	favorites: {
		value: Recipe[],
	},
};

// Typage des props de navigation
type RootStackParamList = {
	Recipe: { recipe: Recipe },
};

type Props = NativeStackScreenProps<RootStackParamList, "Recipe">;

const RecipeScreen: FC<Props> = ({ navigation, route }) => {
	const { recipe } = route.params;
	const dispatch = useDispatch();
	const favorites = useSelector((state: RootState) => state.favorites.value);
	const isFavorite = favorites.some((favorite) => favorite.id === recipe.id);

	const [servingNb, setServingNb] = useState<number>(recipe.servingNb);

	const incrementServings = () => {
		const newValue = servingNb + 1;
		setServingNb(newValue);
		if (isFavorite) {
			dispatch(updateServings({ id: recipe.id, servingNb: newValue }));
		}
	};

	const decrementServings = () => {
		if (servingNb > 1) {
			const newValue = servingNb - 1;
			setServingNb(newValue);
			if (isFavorite) {
				dispatch(updateServings({ id: recipe.id, servingNb: newValue }));
			}
		}
	};

	const handlePress = () => {
		if (isFavorite) {
			dispatch(unfavorite(recipe.id));
		} else {
			dispatch(favorite({ ...recipe, servingNb }));
		}
	};

	const ingredients = recipe.ingredients.map((ingredient, i) => (
		<SafeAreaView key={i} style={[styles.safeArea, styles.menuContainer]}>
			<View style={styles.ingredientWrapper}>
				<Text style={styles.menuSubtitle}>{ingredient.name}</Text>
				<Text style={styles.menuSubtitle}>
					{ingredient.amount * servingNb}
					{ingredient.unit && ` ${ingredient.unit}`}
				</Text>
			</View>
		</SafeAreaView>
	));

	return (
		<SafeAreaView style={[styles.safeArea, styles.container]}>
			<TouchableOpacity onPress={() => navigation.goBack()} style={[styles.navigateButton, { marginTop: 60 }]}>
				<Ionicons name="arrow-back" size={25} color="#655074" />
			</TouchableOpacity>

			<View style={[styles.imageContainer, { height: 260 }]}>
				<View style={{ ...styles.imageWrapper, backgroundColor: recipe.color }}>
					<Image source={recipe.image} style={styles.image} resizeMode="contain" />
				</View>
			</View>

			<View style={{ ...styles.contentContainer, backgroundColor: recipe.color }}>
				<View style={styles.contentWrapper}>
					<TouchableOpacity style={styles.addButton} onPress={handlePress}>
						<Ionicons name={isFavorite ? "bookmark" : "bookmark-outline"} size={20} color="#ffffff" />
					</TouchableOpacity>

					<View style={styles.iconContainer}>
						<View style={styles.iconWrapper}>
							<Ionicons name="speedometer-outline" size={24} color={recipe.color} style={styles.iconContent} />
							<Text style={styles.iconText}>{recipe.level}</Text>
						</View>
						<View>
							<Ionicons name="timer-sharp" size={24} color={recipe.color} style={styles.iconContent} />
							<Text style={styles.iconText}>{recipe.time}</Text>
						</View>
						<View>
							<Ionicons name="star-outline" size={20} color={recipe.color} style={styles.iconContent} />
							<Text style={styles.iconText}>{recipe.rating}</Text>
						</View>
					</View>

					<View style={styles.content}>
						<Text style={styles.title}>{recipe.name}</Text>
						<Text style={styles.contentText}>{recipe.longDesc}</Text>
					</View>

					<View style={{ ...styles.menuContainer, marginBottom: 10 }}>
						<View>
							<Text style={styles.menuTitle}>Ingredients</Text>
							<Text style={styles.menuSubtitle}>How many servings?</Text>
						</View>
						<View style={styles.buttonGroup}>
							<TouchableOpacity style={styles.button} onPress={decrementServings}>
								<Text style={styles.buttonText}>-</Text>
							</TouchableOpacity>
							<View style={styles.button}>
								<Text style={styles.buttonText}>{servingNb}</Text>
							</View>
							<TouchableOpacity style={styles.button} onPress={incrementServings}>
								<Text style={styles.buttonText}>+</Text>
							</TouchableOpacity>
						</View>
					</View>

					<ScrollView showsVerticalScrollIndicator={false}>{ingredients}</ScrollView>
				</View>
			</View>
		</SafeAreaView>
	);
};

export default RecipeScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "flex-start",
		alignItems: "center",
		position: "relative",
	},
	image: {
		width: "70%",
	},
	imageContainer: {
		backgroundColor: "white",
		width: "100%",
		position: "relative",
	},
	imageWrapper: {
		width: "100%",
		height: "100%",
		borderBottomLeftRadius: 120,
		overflow: "hidden",
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	contentContainer: {
		height: "65%",
		width: "100%",
	},
	contentWrapper: {
		borderTopRightRadius: 120,
		height: "100%",
		width: "100%",
		backgroundColor: "white",
		padding: 30,
		position: "relative",
		paddingTop: 55,
	},
	content: {
		width: "100%",
		display: "flex",
		marginBottom: 20,
	},
	title: {
		color: "#46494c",
		fontSize: 36,
		fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
	},
	contentText: {
		color: "#4e5155",
		fontSize: 12,
	},
	iconContainer: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-around",
		width: "100%",
		marginBottom: 25,
		paddingRight: 10,
	},
	iconWrapper: {
		display: "flex",
		alignItems: "center",
	},
	iconContent: {
		textAlign: "center",
	},
	iconText: {
		fontWeight: "bold",
		color: "#46494c",
		textAlign: "center",
	},
	menuContainer: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		padding: 3,
	},
	menuTitle: {
		fontWeight: "bold",
		fontSize: 14,
		color: "#46494c",
	},
	menuSubtitle: {
		fontWeight: "bold",
		fontSize: 12,
		color: "#8a8e93",
	},
	buttonGroup: {
		display: "flex",
		flexDirection: "row",
		borderRadius: 40,
		overflow: "hidden",
		backgroundColor: "2px solid rgba(0, 0, 0, 0.05)",
	},
	buttonText: {
		fontWeight: "bold",
		color: "#655074",
	},
	button: {
		padding: 15,
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	ingredientWrapper: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		borderBottomColor: "rgba(0, 0, 0, 0.01)",
		borderBottomWidth: 1,
		width: "100%",
		paddingTop: 20,
		paddingBottom: 20,
	},
	navigateButton: {
		position: "absolute",
		left: 15,
		zIndex: 2,
	},
	addButton: {
		position: "absolute",
		top: -15,
		right: 25,
		borderRadius: 50,
		backgroundColor: "#655074",
		padding: 20,
	},
});
