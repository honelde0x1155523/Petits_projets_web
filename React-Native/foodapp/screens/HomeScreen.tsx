import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { FC } from "react";

type RootStackParamList = {
	DrawerNavigator: undefined,
};

type HomeScreenProps = {
	navigation: NativeStackNavigationProp<RootStackParamList, "DrawerNavigator">,
};

const HomeScreen: FC<HomeScreenProps> = ({ navigation }) => {
	return (
		<SafeAreaView style={[styles.safeArea, styles.container]}>
			<View style={styles.imageWrapper}>
				<Image style={styles.imageBackground} source={require("../assets/images/home.jpg")} />
			</View>

			<TouchableOpacity onPress={() => navigation.navigate("DrawerNavigator")} style={styles.menu} activeOpacity={1}>
				<Text style={styles.title}>FoodApp</Text>
				<View style={styles.iconWrapper}>
					<Text style={styles.menuText}>Let's go!</Text>
					<Ionicons name="arrow-forward" size={28} style={styles.icon} />
				</View>
			</TouchableOpacity>
		</SafeAreaView>
	);
};

export default HomeScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	title: {
		fontSize: 70,
		fontWeight: "bold",
		color: "#ffffff",
		marginBottom: 10,
		textAlign: "right",
	},
	menu: {
		backgroundColor: "#655074",
		height: "20%",
		alignItems: "flex-end",
		justifyContent: "center",
		paddingRight: 20,
		// React Native ne supporte pas la propriété "border" directement
	},
	menuText: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#ffffff",
		marginRight: 10,
		marginBottom: 25,
	},
	imageWrapper: {
		height: "80%",
		backgroundColor: "#655074",
	},
	imageBackground: {
		width: "100%",
		height: "100%",
		borderBottomLeftRadius: 160,
		backgroundColor: "#ffffff",
	},
	iconWrapper: {
		flexDirection: "row",
	},
	icon: {
		color: "#ffffff",
		position: "relative",
		bottom: 2,
	},
	safeArea: {}, // vide ici car il est combiné avec container
});
