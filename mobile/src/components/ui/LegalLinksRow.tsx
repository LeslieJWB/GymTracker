import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "../../config/legalUrls";
import { palette, spacing, textStyles, withPressScale } from "../../styles/theme";

type LegalLinksRowProps = {
  centered?: boolean;
  showDivider?: boolean;
};

async function openLegalUrl(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return;
  }
  await Linking.openURL(url);
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [styles.linkButton, withPressScale(pressed)]}
      onPress={() => {
        openLegalUrl(url).catch(() => {});
      }}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export function LegalLinksRow({ centered = true, showDivider = true }: LegalLinksRowProps) {
  return (
    <View style={[styles.container, showDivider ? styles.containerWithDivider : null]}>
      <View style={[styles.row, centered ? styles.rowCentered : null]}>
        <LegalLink label="Terms of Use" url={TERMS_OF_USE_URL} />
        <View style={styles.separator} />
        <LegalLink label="Privacy Policy" url={PRIVACY_POLICY_URL} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm
  },
  containerWithDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: spacing.md
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  rowCentered: {
    justifyContent: "center"
  },
  linkButton: {
    paddingVertical: 2
  },
  link: {
    color: palette.primary,
    fontSize: 13,
    fontFamily: textStyles.bodySemiBold.fontFamily,
    letterSpacing: 0.15
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: palette.border
  }
});
