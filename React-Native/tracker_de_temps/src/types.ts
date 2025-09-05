// src/types.ts
import uuid from "react-native-uuid";

export type CadreDTO = {
	id: string;
	nom: string;
	totalMs: number;
	enCours: boolean;
	debut: number | null;
};

export type Cadre = CadreDTO;

export const createCadre = (nom: string): Cadre => ({
	id: String(uuid.v4()), // v4 sync, compatible RN
	nom,
	totalMs: 0,
	enCours: false,
	debut: null,
});

export const reviveCadre = (o: any): Cadre => ({
	id: String(o.id),
	nom: String(o.nom),
	totalMs: Number(o.totalMs ?? 0),
	enCours: Boolean(o.enCours),
	debut: typeof o.debut === "number" ? o.debut : o.debut ? Number(o.debut) : null,
});

export type DayData = Record<string, CadreDTO[]>;
