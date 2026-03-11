import { StyleSheet, Text, View } from "react-native";
import type { FragranceApiItem } from "@/lib/api";

// ─── Primitives ──────────────────────────────────────────────────────────────

function StatBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? count / total : 0;
  const pctLabel = total > 0 ? `${Math.round(pct * 100)}%` : "—";
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barMeta}>
          {count} · {pctLabel}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FragranceStats({ item }: { item: FragranceApiItem }) {
  // Season
  const summerC  = item.summer_count  ?? 0;
  const winterC  = item.winter_count  ?? 0;
  const dayC     = item.day_count     ?? 0;
  const nightC   = item.night_count   ?? 0;
  const seasonTotal = summerC + winterC + dayC + nightC;

  // Sillage
  const noSil     = item.no_sillage_count       ?? 0;
  const lightSil  = item.light_sillage_count    ?? 0;
  const modSil    = item.moderate_sillage_count ?? 0;
  const strongSil = item.strong_sillage_count   ?? 0;
  const sillageTotal = noSil + lightSil + modSil + strongSil;

  // Longevity
  const h02  = item.h0_2_longevity_count    ?? 0;
  const h24  = item.h2_4_longevity_count    ?? 0;
  const h46  = item.h4_6_longevity_count    ?? 0;
  const h68  = item.h6_8_longevity_count    ?? 0;
  const h810 = item.h8_10_longevity_count   ?? 0;
  const h10p = item.h10_plus_longevity_count ?? 0;
  const longevityTotal = h02 + h24 + h46 + h68 + h810 + h10p;

  // Value
  const superOP  = item.super_overpriced_value_count ?? 0;
  const overP    = item.overpriced_value_count       ?? 0;
  const alright  = item.alright_value_count          ?? 0;
  const goodVal  = item.good_value_count             ?? 0;
  const superVal = item.super_value_count            ?? 0;
  const valueTotal = superOP + overP + alright + goodVal + superVal;

  // Gender
  const female   = item.gender_female_count          ?? 0;
  const slFemale = item.gender_slightly_female_count ?? 0;
  const unisex   = item.gender_unisex_count          ?? 0;
  const slMale   = item.gender_slightly_male_count   ?? 0;
  const male     = item.gender_male_count            ?? 0;
  const genderTotal = female + slFemale + unisex + slMale + male;

  const hasAnyStats = seasonTotal + sillageTotal + longevityTotal + valueTotal + genderTotal > 0;

  return (
    <View>
      <Text style={styles.sectionTitle}>Community Stats</Text>

      {/* Top-line summary pills */}
      <View style={styles.pillRow}>
        <StatPill
          label="Avg Rating"
          value={item.rating_value ? Number(item.rating_value).toFixed(2) : "—"}
        />
        <StatPill
          label="Ratings"
          value={String(item.rating_count ?? 0)}
        />
        {item.maceration_average != null && (
          <StatPill
            label="Avg Maceration"
            value={`${Number(item.maceration_average).toFixed(1)} wks`}
          />
        )}
      </View>

      {!hasAnyStats ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No community stats yet.</Text>
          <Text style={styles.emptySubtext}>Be the first to review this fragrance!</Text>
        </View>
      ) : (
        <>
          {/* Season & Occasion */}
          {seasonTotal > 0 && (
            <StatGroup title="Season & Occasion">
              <StatBar label="Summer" count={summerC}  total={seasonTotal} color="#f59e0b" />
              <StatBar label="Winter" count={winterC}  total={seasonTotal} color="#60a5fa" />
              <StatBar label="Day"    count={dayC}     total={seasonTotal} color="#fbbf24" />
              <StatBar label="Night"  count={nightC}   total={seasonTotal} color="#818cf8" />
            </StatGroup>
          )}

          {/* Sillage */}
          {sillageTotal > 0 && (
            <StatGroup title="Sillage">
              <StatBar label="No Sillage"       count={noSil}     total={sillageTotal} color="#cbd5e1" />
              <StatBar label="Light Sillage"    count={lightSil}  total={sillageTotal} color="#93c5fd" />
              <StatBar label="Moderate Sillage" count={modSil}    total={sillageTotal} color="#3b82f6" />
              <StatBar label="Strong Sillage"   count={strongSil} total={sillageTotal} color="#1d4ed8" />
            </StatGroup>
          )}

          {/* Longevity */}
          {longevityTotal > 0 && (
            <StatGroup title="Longevity">
              <StatBar label="0 – 2 hrs"  count={h02}  total={longevityTotal} color="#d1fae5" />
              <StatBar label="2 – 4 hrs"  count={h24}  total={longevityTotal} color="#6ee7b7" />
              <StatBar label="4 – 6 hrs"  count={h46}  total={longevityTotal} color="#34d399" />
              <StatBar label="6 – 8 hrs"  count={h68}  total={longevityTotal} color="#10b981" />
              <StatBar label="8 – 10 hrs" count={h810} total={longevityTotal} color="#059669" />
              <StatBar label="10+ hrs"    count={h10p} total={longevityTotal} color="#065f46" />
            </StatGroup>
          )}

          {/* Value */}
          {valueTotal > 0 && (
            <StatGroup title="Value for Money">
              <StatBar label="Super Overpriced" count={superOP}  total={valueTotal} color="#f87171" />
              <StatBar label="Overpriced"        count={overP}    total={valueTotal} color="#fb923c" />
              <StatBar label="Perfectly Priced"  count={alright}  total={valueTotal} color="#facc15" />
              <StatBar label="Good Value"        count={goodVal}  total={valueTotal} color="#86efac" />
              <StatBar label="Super Value"       count={superVal} total={valueTotal} color="#22c55e" />
            </StatGroup>
          )}

          {/* Gender */}
          {genderTotal > 0 && (
            <StatGroup title="Gender Impression">
              <StatBar label="Female"          count={female}   total={genderTotal} color="#f9a8d4" />
              <StatBar label="Slightly Female" count={slFemale} total={genderTotal} color="#e879f9" />
              <StatBar label="Unisex"          count={unisex}   total={genderTotal} color="#a78bfa" />
              <StatBar label="Slightly Male"   count={slMale}   total={genderTotal} color="#60a5fa" />
              <StatBar label="Male"            count={male}     total={genderTotal} color="#2563eb" />
            </StatGroup>
          )}
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 12, marginTop: 18 },

  pillRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  pill: { flex: 1, backgroundColor: "#f2f2f2", borderRadius: 12, padding: 12, alignItems: "center" },
  pillValue: { fontSize: 18, fontWeight: "900", color: "#111" },
  pillLabel: { fontSize: 11, color: "#666", fontWeight: "700", marginTop: 3 },

  group: { marginTop: 16 },
  groupTitle: { fontSize: 13, fontWeight: "800", color: "#444", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },

  barRow: { marginBottom: 10 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabel: { fontSize: 13, color: "#333", fontWeight: "600" },
  barMeta: { fontSize: 12, color: "#888" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#f0f0f0", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },

  emptyBox: { backgroundColor: "#fafafa", borderRadius: 12, padding: 16, marginTop: 8, alignItems: "center" },
  emptyText: { fontSize: 14, fontWeight: "800", color: "#111" },
  emptySubtext: { fontSize: 13, color: "#777", marginTop: 4 },
});
