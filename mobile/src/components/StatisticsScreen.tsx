import { useMemo, useState } from "react";
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { palette, radius, shadows, textStyles, withPressScale } from "../styles/theme";
import {
  BodyWeightRecord,
  ExerciseDailyMetricsPoint,
  ExerciseItem,
  NutritionDailyPoint
} from "../types/workout";

type StatisticsScreenProps = {
  loading: boolean;
  exerciseItems: ExerciseItem[];
  weightRecords: BodyWeightRecord[];
  nutritionRecords: NutritionDailyPoint[];
  selectedExerciseItemId: string | null;
  exerciseMetricRecords: ExerciseDailyMetricsPoint[];
  refreshStatistics: () => Promise<void> | void;
  selectExerciseForMetrics: (exerciseItemId: string) => void;
};

type NumericPoint = { date: string; value: number };

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function chartWidth(pointCount: number): number {
  return Math.max(360, pointCount * 60);
}

function dateLabel(date: string): string {
  return date.slice(5);
}

function compactLabels(dates: string[]): string[] {
  if (dates.length === 0) {
    return [];
  }
  const maxTickCount = 6;
  const step = Math.max(1, Math.ceil(dates.length / maxTickCount));
  return dates.map((date, index) =>
    index === dates.length - 1 || index % step === 0 ? dateLabel(date) : ""
  );
}

function SingleLineCard({
  title,
  emptyText,
  unitSuffix,
  decimalPlaces,
  lineColor,
  points
}: {
  title: string;
  emptyText: string;
  unitSuffix: string;
  decimalPlaces?: number;
  lineColor: string;
  points: NumericPoint[];
}) {
  const chartData = points.map((item) => item.value);
  const labels = compactLabels(points.map((item) => item.date));
  const width = chartWidth(chartData.length || 1);
  const baseWidth = Dimensions.get("window").width - 56;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {chartData.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={{
              labels,
              datasets: [{ data: chartData }]
            }}
            width={Math.max(baseWidth, width)}
            height={260}
            yAxisSuffix={unitSuffix}
            withShadow={false}
            withInnerLines
            withOuterLines={false}
            withVerticalLines={false}
            bezier
            chartConfig={{
              backgroundGradientFrom: "#FEFEFA",
              backgroundGradientTo: "#FEFEFA",
                decimalPlaces: decimalPlaces ?? 0,
              color: () => lineColor,
              labelColor: () => palette.mutedForeground,
              propsForDots: {
                r: "3",
                strokeWidth: "1",
                stroke: lineColor,
                fill: "#FEFEFA"
              },
              propsForBackgroundLines: {
                stroke: "#EAE4DC"
              }
            }}
            style={styles.lineChart}
          />
        </ScrollView>
      )}
    </View>
  );
}

export function StatisticsScreen({
  loading,
  exerciseItems,
  weightRecords,
  nutritionRecords,
  selectedExerciseItemId,
  exerciseMetricRecords,
  refreshStatistics,
  selectExerciseForMetrics
}: StatisticsScreenProps) {
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [exerciseDropdownVisible, setExerciseDropdownVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshHint, setRefreshHint] = useState("Pull down to refresh.");
  const selectedExercise = useMemo(
    () => exerciseItems.find((item) => item.id === selectedExerciseItemId) ?? null,
    [exerciseItems, selectedExerciseItemId]
  );

  const filteredExerciseItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(exerciseSearchTerm);
    if (!normalizedQuery) {
      return exerciseItems.slice(0, 8);
    }
    const queryTerms = normalizedQuery.split(" ").filter(Boolean);
    return exerciseItems
      .map((item) => {
        const normalizedName = normalizeSearchText(item.name);
        const nameTerms = normalizedName.split(" ").filter(Boolean);
        let score = normalizedName.includes(normalizedQuery) ? 200 : 0;
        for (const queryTerm of queryTerms) {
          const termScore = nameTerms.reduce((bestScore, nameTerm) => {
            if (nameTerm === queryTerm) return Math.max(bestScore, 40);
            if (nameTerm.startsWith(queryTerm)) return Math.max(bestScore, 25);
            if (nameTerm.includes(queryTerm)) return Math.max(bestScore, 10);
            return bestScore;
          }, 0);
          if (termScore === 0 && !normalizedName.includes(queryTerm)) {
            return null;
          }
          score += termScore;
        }
        return { item, score };
      })
      .filter((entry): entry is { item: ExerciseItem; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, 8)
      .map((entry) => entry.item);
  }, [exerciseItems, exerciseSearchTerm]);

  const nutritionCaloriesPoints = nutritionRecords
    .filter((row) => row.totalCaloriesKcal > 0)
    .map((row) => ({
      date: row.date,
      value: row.totalCaloriesKcal
    }));
  const nutritionProteinPoints = nutritionRecords
    .filter((row) => row.totalProteinG > 0)
    .map((row) => ({
      date: row.date,
      value: row.totalProteinG
    }));

  async function handlePullToRefresh(): Promise<void> {
    if (loading || isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    setRefreshHint("Refreshing...");
    try {
      await Promise.resolve(refreshStatistics());
      setRefreshHint(`Refreshed at ${new Date().toLocaleTimeString()}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            handlePullToRefresh().catch(() => {});
          }}
          tintColor={palette.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>
      <Text style={styles.refreshHintText}>{refreshHint}</Text>

      <SingleLineCard
        title="Body Weight Trend"
        emptyText="No weight records yet."
        unitSuffix=" kg"
        decimalPlaces={1}
        lineColor={palette.primary}
        points={weightRecords.map((row) => ({ date: row.date, value: row.weightKg }))}
      />

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Exercise Trend</Text>
        <TextInput
          style={styles.searchInput}
          value={exerciseSearchTerm}
          onChangeText={setExerciseSearchTerm}
          onFocus={() => setExerciseDropdownVisible(true)}
          onBlur={() => {
            setTimeout(() => setExerciseDropdownVisible(false), 140);
          }}
          placeholder="Search exercise..."
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {exerciseDropdownVisible ? (
          <View style={styles.searchResultList}>
            {filteredExerciseItems.length === 0 ? (
              <Text style={styles.emptyText}>No exercise matches your search.</Text>
            ) : (
              filteredExerciseItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.searchResultRow,
                    selectedExerciseItemId === item.id ? styles.searchResultRowActive : null,
                    withPressScale(pressed)
                  ]}
                  onPress={() => {
                    selectExerciseForMetrics(item.id);
                    setExerciseSearchTerm(item.name);
                    setExerciseDropdownVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.searchResultText,
                      selectedExerciseItemId === item.id ? styles.searchResultTextActive : null
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
        {selectedExercise ? (
          <Text style={styles.selectedExerciseLabel}>Selected: {selectedExercise.name}</Text>
        ) : (
          <Text style={styles.emptyText}>Select an exercise to view trend charts.</Text>
        )}
      </View>

      <SingleLineCard
        title="Exercise Daily Volume"
        emptyText="No completed volume records for selected exercise."
        unitSuffix=""
        lineColor={palette.secondary}
        points={exerciseMetricRecords.map((row) => ({ date: row.date, value: row.dailyVolume }))}
      />
      <SingleLineCard
        title="Exercise Top Set Weight"
        emptyText="No top set weight records for selected exercise."
        unitSuffix=" kg"
        decimalPlaces={1}
        lineColor={palette.primary}
        points={exerciseMetricRecords.map((row) => ({ date: row.date, value: row.topSetWeight }))}
      />
      <SingleLineCard
        title="Exercise Top Set Volume"
        emptyText="No top set volume records for selected exercise."
        unitSuffix=""
        lineColor={palette.secondary}
        points={exerciseMetricRecords.map((row) => ({ date: row.date, value: row.topSetVolume }))}
      />

      <SingleLineCard
        title="Calories Trend"
        emptyText="No calorie records yet."
        unitSuffix=" kcal"
        lineColor={palette.destructive}
        points={nutritionCaloriesPoints}
      />
      <SingleLineCard
        title="Protein Trend"
        emptyText="No protein records yet."
        unitSuffix=" g"
        lineColor={palette.primary}
        points={nutritionProteinPoints}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    ...textStyles.headingMd
  },
  refreshHintText: {
    marginTop: -4,
    color: palette.mutedForeground,
    fontSize: 12,
    fontFamily: textStyles.bodySemiBold.fontFamily
  },
  chartCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${palette.border}80`,
    backgroundColor: "#FEFEFAEE",
    padding: 12,
    ...shadows.soft
  },
  lineChart: {
    borderRadius: radius.md
  },
  chartTitle: {
    color: palette.foreground,
    fontSize: 17,
    fontFamily: textStyles.headingSemiBold.fontFamily,
    marginBottom: 10
  },
  searchInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFFCC",
    color: palette.foreground,
    fontSize: 14
  },
  searchResultList: {
    marginTop: 8,
    gap: 6
  },
  searchResultRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFFD9",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  searchResultRowActive: {
    borderColor: palette.primary,
    backgroundColor: "#E8EEE4"
  },
  searchResultText: {
    color: palette.accentForeground,
    fontFamily: textStyles.bodySemiBold.fontFamily
  },
  searchResultTextActive: {
    color: palette.primary,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  selectedExerciseLabel: {
    marginTop: 10,
    fontSize: 12,
    color: palette.accentForeground,
    fontFamily: textStyles.bodyBold.fontFamily
  },
  emptyText: {
    color: palette.mutedForeground,
    fontSize: 13,
    fontFamily: textStyles.body.fontFamily
  }
});
