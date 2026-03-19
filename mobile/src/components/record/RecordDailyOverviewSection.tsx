import { Text, View } from "react-native";
import type { DailyNutritionTargets } from "../../types/workout";

type RecordDailyOverviewSectionProps = {
  styles: any;
  totalVolume: number;
  totalSetCount: number;
  totalCaloriesKcal: number;
  calorieTarget: number | null;
  calorieOverflow: number;
  calorieProgress: number | null;
  totalProteinG: number;
  proteinTarget: number | null;
  proteinOverflow: number;
  proteinProgress: number | null;
  dailyNutritionTargets: DailyNutritionTargets | null;
};

export function RecordDailyOverviewSection({
  styles,
  totalVolume,
  totalSetCount,
  totalCaloriesKcal,
  calorieTarget,
  calorieOverflow,
  calorieProgress,
  totalProteinG,
  proteinTarget,
  proteinOverflow,
  proteinProgress,
  dailyNutritionTargets
}: RecordDailyOverviewSectionProps) {
  return (
    <View style={styles.dailyMetricsSection}>
      <View style={styles.dailyMetricsHeader}>
        <Text style={styles.dailyMetricsTitle}>Daily Overview</Text>
        <View style={styles.dailyMetricsBadge}>
          <Text style={styles.dailyMetricsBadgeText}>Auto</Text>
        </View>
      </View>
      <Text style={styles.dailyMetricsHint}>These values are calculated from today&apos;s workout and food logs.</Text>
      <View style={styles.statsStrip}>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Total Volume</Text>
          <Text style={styles.statsValue}>{Math.round(totalVolume)} kg</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Completed Sets</Text>
          <Text style={styles.statsValue}>{totalSetCount}</Text>
        </View>
      </View>
      <View style={styles.nutritionProgressCard}>
        <View style={styles.nutritionProgressSection}>
          <Text style={styles.nutritionProgressTitle}>Calorie Progress</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressNumbers}>
              {Math.round(totalCaloriesKcal)} / {calorieTarget ? Math.round(calorieTarget) : "--"} kcal
            </Text>
            {calorieOverflow > 0 ? <Text style={styles.progressOverflow}>+{calorieOverflow} kcal</Text> : null}
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                styles.progressFillCalories,
                { width: `${Math.max(0, Math.min(100, Math.round((calorieProgress ?? 0) * 100)))}%` }
              ]}
            />
          </View>
          <Text style={styles.progressMeta}>
            {calorieTarget ? `${Math.round((calorieProgress ?? 0) * 100)}% of target` : "Estimating daily target..."}
          </Text>
        </View>
        <View style={[styles.nutritionProgressSection, styles.nutritionProgressSectionDivider]}>
          <Text style={styles.nutritionProgressTitle}>Protein Progress</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressNumbers}>
              {Math.round(totalProteinG)} / {proteinTarget ? Math.round(proteinTarget) : "--"} g
            </Text>
            {proteinOverflow > 0 ? <Text style={styles.progressOverflow}>+{proteinOverflow} g</Text> : null}
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                styles.progressFillProtein,
                { width: `${Math.max(0, Math.min(100, Math.round((proteinProgress ?? 0) * 100)))}%` }
              ]}
            />
          </View>
          <Text style={styles.progressMeta}>
            {proteinTarget ? `${Math.round((proteinProgress ?? 0) * 100)}% of target` : "Estimating daily target..."}
          </Text>
          {dailyNutritionTargets?.comment ? <Text style={styles.progressComment}>{dailyNutritionTargets.comment}</Text> : null}
        </View>
      </View>
    </View>
  );
}
