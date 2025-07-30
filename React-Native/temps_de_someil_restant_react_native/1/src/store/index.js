import { configureStore, combineReducers, createSlice } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persistReducer, persistStore } from "redux-persist";

// Slice pour l'heure
const wakeSlice = createSlice({
	name: "wake",
	initialState: { hour: "06", minute: "30" },
	reducers: {
		setHour: (state, action) => {
			state.hour = action.payload;
		},
		setMinute: (state, action) => {
			state.minute = action.payload;
		},
	},
});

export const { setHour, setMinute } = wakeSlice.actions;

// Root reducer combiné
const rootReducer = combineReducers({
	wake: wakeSlice.reducer,
});

// Persist config
const persistConfig = {
	key: "root",
	storage: AsyncStorage,
	whitelist: ["wake"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Store
export const store = configureStore({
	reducer: persistedReducer,
	middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

export const persistor = persistStore(store);
