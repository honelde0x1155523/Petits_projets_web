import { registerRootComponent } from "expo";
import React from "react";
import App from "./App";

import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "./src/store";

// Ligne de purge TEMPORAIRE (efface le storage)
// persistor.purge();

function Root() {
	return (
		<Provider store={store}>
			<PersistGate loading={null} persistor={persistor}>
				<App />
			</PersistGate>
		</Provider>
	);
}

registerRootComponent(Root);
