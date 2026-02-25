import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import { RecordSummary } from "../types/workout";
import { todayDate } from "../utils/date";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarScreenProps = {
  loading: boolean;
  monthCursor: Date;
  recordSummaries: RecordSummary[];
  openDate: (date: string) => void;
  changeMonth: (offset: number) => void;
};

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarCells(monthCursor: Date): Array<string | null> {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const cells: Array<string | null> = Array(firstDayIndex).fill(null);
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(
      toDateString(new Date(year, month, day))
    );
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function CalendarScreen({
  loading,
  monthCursor,
  recordSummaries,
  openDate,
  changeMonth
}: CalendarScreenProps) {
  const monthLabel = useMemo(
    () => monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [monthCursor]
  );

  const markedDates = useMemo(
    () =>
      new Set(recordSummaries.filter((item) => item.setCount > 0).map((item) => item.date)),
    [recordSummaries]
  );
  const recordByDate = useMemo(
    () =>
      new Map(
        recordSummaries.map((item) => [item.date, item] as const)
      ),
    [recordSummaries]
  );
  const activeDays = markedDates.size;
  const totalExercises = useMemo(
    () => recordSummaries.reduce((sum, item) => sum + item.exerciseCount, 0),
    [recordSummaries]
  );

  const cells = useMemo(() => calendarCells(monthCursor), [monthCursor]);
  const today = todayDate();

  return (
    <View style={styles.container}>
      <View style={appStyles.headerRow}>
        <Text style={styles.title}>Calendar</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={[styles.monthNavButton, loading ? styles.monthNavButtonDisabled : undefined]}
            onPress={() => changeMonth(-1)}
            disabled={loading}
          >
            <Text style={styles.monthNavText}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            style={[styles.monthNavButton, loading ? styles.monthNavButtonDisabled : undefined]}
            onPress={() => changeMonth(1)}
            disabled={loading}
          >
            <Text style={styles.monthNavText}>{">"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricPillValue}>{activeDays}</Text>
            <Text style={styles.metricPillLabel}>Active days</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricPillValue}>{totalExercises}</Text>
            <Text style={styles.metricPillLabel}>Exercises</Text>
          </View>
        </View>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.weekRow}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={styles.weekLabel}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((dateValue, index) => {
            if (!dateValue) {
              return (
                <View key={`blank-${index}`} style={styles.dayCellWrap}>
                  <View style={[styles.dayCell, styles.blankCell]} />
                </View>
              );
            }
            const hasExercise = markedDates.has(dateValue);
            const record = recordByDate.get(dateValue);
            const theme = record?.theme?.trim();
            const isToday = dateValue === today;
            const isFuture = dateValue > today;
            return (
              <View key={dateValue} style={styles.dayCellWrap}>
                <TouchableOpacity
                  style={[
                    styles.dayCell,
                    hasExercise ? styles.dayCellMarked : undefined,
                    isToday ? styles.dayCellToday : undefined,
                    isFuture ? styles.dayCellFuture : undefined
                  ]}
                  onPress={() => openDate(dateValue)}
                  disabled={loading || isFuture}
                >
                  <View style={styles.dayContent}>
                    <Text
                      style={[
                        styles.dayText,
                        hasExercise ? styles.dayTextMarked : undefined,
                        isFuture ? styles.dayTextFuture : undefined
                      ]}
                    >
                      {Number(dateValue.slice(8))}
                    </Text>
                    {theme ? (
                      <Text
                        style={[
                          styles.themeText,
                          hasExercise ? styles.themeTextMarked : undefined,
                          isFuture ? styles.themeTextFuture : undefined
                        ]}
                      >
                        {theme}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendBadge} />
        <Text style={appStyles.emptyText}>Green means at least 1 completed set logged</Text>
      </View>
      {loading ? <Text style={styles.loadingText}>Loading month data...</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A"
  },
  summaryCard: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#0F172A",
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  monthNavButton: {
    borderWidth: 1.5,
    borderColor: "#334155",
    borderRadius: 10,
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B"
  },
  monthNavButtonDisabled: {
    opacity: 0.5
  },
  monthNavText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  metricRow: {
    flexDirection: "row",
    gap: 10
  },
  metricPill: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#334155"
  },
  metricPillValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800"
  },
  metricPillLabel: {
    color: "#94A3B8",
    marginTop: 2,
    fontSize: 12
  },
  calendarCard: {
    borderWidth: 0,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 10
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCellWrap: {
    width: "14.2857%",
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  dayCell: {
    width: "100%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    position: "relative"
  },
  blankCell: {
    borderWidth: 0,
    backgroundColor: "transparent"
  },
  dayCellMarked: {
    backgroundColor: "#22C55E",
    borderColor: "#16A34A"
  },
  dayCellToday: {
    borderColor: "#1D4ED8"
  },
  dayCellFuture: {
    backgroundColor: "#EEF2F7",
    borderColor: "#D8E0EA"
  },
  dayContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  dayText: {
    color: "#0F172A",
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
    includeFontPadding: false
  },
  dayTextMarked: {
    color: "#FFFFFF"
  },
  dayTextFuture: {
    color: "#94A3B8"
  },
  themeText: {
    marginTop: 1,
    fontSize: 9,
    color: "#475569",
    fontWeight: "700",
    textTransform: "capitalize"
  },
  themeTextMarked: {
    color: "#E2FFE7"
  },
  themeTextFuture: {
    color: "#94A3B8"
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12
  },
  legendBadge: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#22C55E",
    borderWidth: 0
  },
  loadingText: {
    marginTop: 8,
    color: "#64748B"
  }
});
