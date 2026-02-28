import { StyleSheet } from "react-native";
import { palette, radius, textStyles } from "./theme";

export const appStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
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
    ...textStyles.headingMd,
    marginBottom: 8
  },
  label: {
    fontSize: 14,
    fontFamily: textStyles.bodyBold.fontFamily,
    color: palette.accentForeground,
    marginTop: 8
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFFCC",
    color: palette.foreground
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
    borderRadius: radius.pill,
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
    backgroundColor: palette.primary
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: palette.secondary
  },
  dangerButton: {
    flex: 1,
    backgroundColor: palette.destructive
  },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: textStyles.bodyBold.fontFamily
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: textStyles.headingSemiBold.fontFamily,
    color: palette.foreground,
    marginTop: 16,
    marginBottom: 6
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${palette.border}90`,
    padding: 12,
    marginBottom: 8
  },
  cardTitle: {
    fontFamily: textStyles.bodyBold.fontFamily,
    color: palette.foreground,
    marginBottom: 4
  },
  cardText: {
    color: palette.accentForeground,
    fontFamily: textStyles.body.fontFamily
  },
  emptyText: {
    color: palette.mutedForeground,
    fontFamily: textStyles.body.fontFamily
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
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    padding: 8
  },
  chipRow: {
    marginTop: 8,
    marginBottom: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#FFFFFFCC"
  },
  chipSelected: {
    borderColor: palette.primary,
    backgroundColor: "#E8EEE4"
  },
  chipText: {
    color: palette.accentForeground,
    fontFamily: textStyles.bodySemiBold.fontFamily
  },
  chipTextSelected: {
    color: palette.primary,
    fontFamily: textStyles.bodyBold.fontFamily
  }
});
