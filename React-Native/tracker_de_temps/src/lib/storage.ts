// src/lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DayData } from "../types";

const STORAGE_KEY = "tracker_de_temps_quotidien";

export async function loadAll(): Promise<DayData> {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

export async function saveAll(data: DayData): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
