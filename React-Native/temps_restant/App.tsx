// App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// --- Utils ---
const pad2 = (v: number) => v.toString().padStart(2, "0");
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const minutesBetween = (d1: Date, d2: Date) => Math.floor((d2.getTime() - d1.getTime()) / 60000);
const formatHM = (min: number) => `${Math.floor(min / 60)}h${pad2(min % 60)}`;
const hhmm = (d: Date) => `${pad2(d.getHours())}h${pad2(d.getMinutes())}`;

type Plage = { start: Date; end: Date; label: string };

function buildPlages(now: Date): Plage[] {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  return [
    { start: new Date(y, m, d, 5, 0, 0),  end: new Date(y, m, d, 8, 0, 0),  label: "pré-journée" },
    { start: new Date(y, m, d, 9, 0, 0),  end: new Date(y, m, d, 13, 0, 0), label: "matin" },
    { start: new Date(y, m, d, 13, 30, 0),end: new Date(y, m, d, 17, 30, 0),label: "après-midi" },
    { start: new Date(y, m, d, 18, 30, 0),end: new Date(y, m, d, 22, 30, 0),label: "soirée" },
  ];
}
const getActivePlage = (plages: Plage[], now: Date) =>
  plages.find((p) => now >= p.start && now < p.end) ?? null;

export default function App() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const plages = useMemo(() => buildPlages(now), [now]);
  const active = useMemo(() => getActivePlage(plages, now), [plages, now]);

  const { totalMinutes, usedMinutes, remainingMinutes, lines, diffH, diffM, elapsedH, elapsedM } =
    useMemo(() => {
      let total = 0;
      for (const p of plages) total += minutesBetween(p.start, p.end);

      let used = 0;
      for (const p of plages) {
        if (now >= p.end) used += minutesBetween(p.start, p.end);
        else if (now >= p.start && now < p.end) used += minutesBetween(p.start, now);
      }
      const remaining = total - used;

      const lineItems = plages.map((p) => {
        const totalInterval = minutesBetween(p.start, p.end);
        let consumed = 0, remainingMin = 0;
        if (now >= p.end) {
          consumed = totalInterval; remainingMin = 0;
        } else if (now < p.start) {
          consumed = 0; remainingMin = totalInterval;
        } else {
          consumed = minutesBetween(p.start, now);
          remainingMin = minutesBetween(now, p.end);
        }
        return {
          key: p.label,
          label: capitalize(p.label),
          total: formatHM(totalInterval),
          consumed: formatHM(consumed),
          remaining: formatHM(remainingMin),
        };
      });

      let dH = 0, dM = 0, eH = 0, eM = 0;
      if (active) {
        const diffMs = active.end.getTime() - now.getTime();
        dH = Math.floor(diffMs / 3_600_000);
        dM = Math.floor((diffMs % 3_600_000) / 60_000);
        const elapsedMs = now.getTime() - active.start.getTime();
        eH = Math.floor(elapsedMs / 3_600_000);
        eM = Math.floor((elapsedMs % 3_600_000) / 60_000);
      }

      return { totalMinutes: total, usedMinutes: used, remainingMinutes: remaining, lines: lineItems,
        diffH: dH, diffM: dM, elapsedH: eH, elapsedM: eM };
    }, [plages, now, active]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "right", "bottom", "left"]}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.centered} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>
              Journée totale : <Text style={styles.strong}>{formatHM(totalMinutes)}</Text>
            </Text>
            <Text style={styles.subtitle}>
              Temps consommé : <Text style={styles.strong}>{formatHM(usedMinutes)}</Text> — Temps restant :{" "}
              <Text style={styles.strong}>{formatHM(remainingMinutes)}</Text>
            </Text>
            {lines.map((l) => (
              <Text key={l.key} style={styles.line}>
                <Text style={styles.strong}>{l.label}</Text> ({l.total}) : consommé {l.consumed} — restant {l.remaining}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            {!active ? (
              <>
                <Text style={styles.subtitle}>Aucun compte à rebours actif actuellement.</Text>
                <Text style={styles.timer}>--:--</Text>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Compte à rebours pour <Text style={styles.strong}>{active.label}</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Début : {hhmm(active.start)} — Fin : {hhmm(active.end)}
                </Text>
                <Text style={styles.subtitle}>
                  Écoulé : {pad2(elapsedH)}:{pad2(elapsedM)}
                </Text>
                <Text style={styles.timer}>
                  {pad2(diffH)}:{pad2(diffM)}
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// --- Styles ---
const BLUE = "#4a90e2";
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f2f5" },
  centered: {
    flexGrow: 1,
    justifyContent: "center",   // centrage vertical
    alignItems: "center",        // centrage horizontal
    padding: 16,
  },
  card: {
    backgroundColor: BLUE,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 20,
    minWidth: 320,
    width: "100%",
    maxWidth: 520,
    marginVertical: 8,
    elevation: 4,
  },
  title: { color: "#dbe9ff", fontSize: 16, fontWeight: "700" },
  subtitle: { color: "white", fontSize: 16, fontWeight: "600", marginTop: 6, textAlign: "center" },
  line: { color: "#eef5ff", fontSize: 14, marginTop: 6 },
  strong: { fontWeight: "700", color: "white" },
  timer: { marginTop: 12, color: "white", fontSize: 48, fontWeight: "700", letterSpacing: 1, textAlign: "center" },
});
