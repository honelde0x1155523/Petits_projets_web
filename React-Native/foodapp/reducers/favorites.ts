import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Typage de la recette
export type Ingredient = {
	name: string,
	amount: number,
	unit?: string,
};

export type Recipe = {
	id: string,
	name: string,
	image: any, // adapte si image vient d'un URI ou de require()
	color: string,
	level: string,
	time: string,
	rating: number,
	longDesc: string,
	servingNb: number,
	ingredients: Ingredient[],
};

// Typage de l’état
type FavoritesState = {
	value: Recipe[],
};

const initialState: FavoritesState = {
	value: [],
};

export const favoritesSlice = createSlice({
	name: "favorites",
	initialState,
	reducers: {
		favorite: (state, action: PayloadAction<Recipe>) => {
			state.value.push(action.payload);
		},
		unfavorite: (state, action: PayloadAction<string>) => {
			state.value = state.value.filter((e) => e.id !== action.payload);
		},
		updateServings: (state, action: PayloadAction<{ id: string, servingNb: number }>) => {
			const recipe = state.value.find((e) => e.id === action.payload.id);
			if (recipe) {
				recipe.servingNb = action.payload.servingNb;
			}
		},
	},
});

export const { favorite, unfavorite, updateServings } = favoritesSlice.actions;
export default favoritesSlice.reducer;
