// Calcule le nombre d'heures (virgule flottante) restantes avant l'heure de réveil.
export const hoursUntilWake = (wakeDate) => {
	const now = new Date();
	const wake = new Date(wakeDate); // clone

	if (wake <= now) {
		wake.setDate(wake.getDate() + 1); // réveil le lendemain si besoin
	}

	const diffMs = wake - now;
	return diffMs / (1000 * 60 * 60);
};
