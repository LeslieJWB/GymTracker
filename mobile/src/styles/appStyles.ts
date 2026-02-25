import { StyleSheet } from "react-native";

export const appStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FC"
  },
  flex: {
    flex: 1
  },
  homeScrollContainer: {
    flexGrow: 1,
    padding: 16
  },
  homeContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  container: {
    padding: 16,
    gap: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#D4D8E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF"
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  col: {
    flex: 1
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    marginTop: 8
  },
  smallButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1B6EF3"
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#2E3A59"
  },
  dangerButton: {
    flex: 1,
    backgroundColor: "#C0392B"
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EE",
    padding: 12,
    marginBottom: 8
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 4
  },
  cardText: {
    color: "#334155"
  },
  emptyText: {
    color: "#64748B"
  },
  listFooter: {
    paddingVertical: 8,
    alignItems: "center",
    gap: 6
  },
  dateListRegion: {
    flex: 1,
    minHeight: 280,
    maxHeight: 560,
    marginHorizontal: 2,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#D8DEEA",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 8
  },
  chipRow: {
    marginTop: 8,
    marginBottom: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#FFFFFF"
  },
  chipSelected: {
    borderColor: "#1B6EF3",
    backgroundColor: "#E8F0FF"
  },
  chipText: {
    color: "#334155"
  },
  chipTextSelected: {
    color: "#1D4ED8",
    fontWeight: "700"
  }
});
