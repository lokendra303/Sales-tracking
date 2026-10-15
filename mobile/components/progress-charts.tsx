import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, radius, typo } from "@/lib/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RingProps = {
  percent: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  lightLabel?: boolean;
};

/** Circular progress ring for targets and completion. */
export function ProgressRing({
  percent,
  size = 112,
  thickness = 10,
  color = "#4ADE80",
  trackColor = "rgba(255,255,255,0.18)",
  label,
  sublabel,
  lightLabel = false,
}: RingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const radiusPx = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamped / 100,
      duration: 750,
      useNativeDriver: false,
    }).start();
  }, [clamped, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.ringLabel, lightLabel && { color: "#fff" }]}>{label ?? `${clamped}%`}</Text>
      {sublabel ? <Text style={[styles.ringSub, lightLabel && { color: "#BFDBFE" }]}>{sublabel}</Text> : null}
    </View>
  );
}

export type BarPoint = { key: string; label: string; value: number; color?: string };

export function BarChart({
  points,
  height = 128,
  emptyText = "No activity yet",
}: {
  points: BarPoint[];
  height?: number;
  emptyText?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  if (!points.length || points.every((p) => p.value === 0)) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={[styles.barChart, { height }]}>
      {points.map((point) => {
        const h = Math.max(point.value ? 8 : 3, Math.round((point.value / max) * (height - 32)));
        return (
          <View key={point.key} style={styles.barCol}>
            <Text style={styles.barValue}>{point.value || ""}</Text>
            <View style={[styles.barTrack, { height: height - 32 }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: h,
                    backgroundColor: point.color ?? colors.blue,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>
              {point.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type MixSlice = { key: string; label: string; value: number; color: string };

/** Horizontal segmented progress bar + legend. */
export function MixBar({ slices, title }: { slices: MixSlice[]; title?: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <View style={styles.mix}>
      {title ? <Text style={styles.mixTitle}>{title}</Text> : null}
      <View style={styles.mixTrack}>
        {total === 0 ? (
          <View style={[styles.mixSeg, { flex: 1, backgroundColor: colors.line }]} />
        ) : (
          slices.map((slice) =>
            slice.value > 0 ? (
              <View key={slice.key} style={[styles.mixSeg, { flex: slice.value, backgroundColor: slice.color }]} />
            ) : null,
          )
        )}
      </View>
      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendText}>
              {slice.label} · {slice.value}
              {total ? ` (${Math.round((slice.value / total) * 100)}%)` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TargetHero({
  amountLabel,
  percent,
  sublabel,
}: {
  amountLabel: string;
  percent: number;
  sublabel: string;
}) {
  return (
    <View style={styles.targetHero}>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={styles.targetKicker}>Monthly progress</Text>
        <Text style={styles.targetAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {amountLabel}
        </Text>
        <Text style={styles.targetSub}>{sublabel}</Text>
      </View>
      <ProgressRing
        percent={percent}
        size={100}
        thickness={9}
        color="#4ADE80"
        trackColor="rgba(255,255,255,0.18)"
        label={`${Math.min(100, Math.round(percent || 0))}%`}
        sublabel="target"
        lightLabel
      />
    </View>
  );
}

export function lastNDays(n: number, values: Record<string, number>, color = colors.blue): BarPoint[] {
  const out: BarPoint[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2);
    out.push({ key, label, value: values[key] ?? 0, color });
  }
  return out;
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useCountByDay(items: { at: string }[]) {
  return useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      const key = dayKey(item.at);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [items]);
}

const styles = StyleSheet.create({
  ringLabel: { fontSize: 18, fontWeight: "800", color: colors.text },
  ringSub: { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: -2 },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { width: "100%", justifyContent: "flex-end", alignItems: "center" },
  barFill: { width: "72%", borderTopLeftRadius: 8, borderTopRightRadius: 8, minHeight: 3 },
  barValue: { fontSize: 11, fontWeight: "800", color: colors.text, height: 14 },
  barLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  empty: { ...typo.muted, textAlign: "center", paddingVertical: 16 },
  mix: { gap: 10 },
  mixTitle: { fontWeight: "800", color: colors.text, fontSize: 15 },
  mixTrack: {
    height: 14,
    borderRadius: radius.pill,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: colors.line,
  },
  mixSeg: { height: 14 },
  legend: { gap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typo.muted, fontWeight: "600" },
  targetHero: {
    borderRadius: radius.lg,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.ink,
  },
  targetKicker: { fontWeight: "700", fontSize: 12, color: "#BFDBFE", letterSpacing: 0.3 },
  targetAmount: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.4 },
  targetSub: { fontSize: 13, fontWeight: "600", color: "#BFDBFE" },
});
