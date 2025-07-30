import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import SleepCalculator from "./src/components/SleepCalculator";

export default function App() {
	return (
		<SafeAreaView style={styles.container}>
			<SleepCalculator />
			<StatusBar style="auto" />
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
});
