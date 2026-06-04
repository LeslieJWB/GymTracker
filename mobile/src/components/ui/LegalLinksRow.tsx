import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "../../config/legalUrls";
import { palette, textStyles } from "../../styles/theme";

type LegalLinksRowProps = {
  centered?: boolean;
};

async function openLegalUrl(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return;
  }
  await Linking.openURL(url);
}

export function LegalLinksRow({ centered = false }: LegalLinksRowProps) {
  return (
    <View style={[styles.row, centered ? styles.rowCentered : null]}>
      <Pressable
        hitSlop={8}
        onPress={() => {
          openLegalUrl(TERMS_OF_USE_URL).catch(() => {});
        }}
      >
        <Text style={styles.link}>Terms of Use</Text>
      </Pressable>
      <Text style={styles.separator}>•</Text>
      <Pressable
        hitSlop={8}
        onPress={() => {
          openLegalUrl(PRIVACY_POLICY_URL).catch(() => {});
        }}
      >
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  rowCentered: {
    justifyContent: "center"
  },
  link: {
    color: palette.primary,
    fontSize: 13,
    fontFamily: textStyles.bodyBold.fontFamily,
    textDecorationLine: "underline"
  },
  separator: {
    color: palette.mutedForeground,
    fontSize: 13,
    fontFamily: textStyles.body.fontFamily
  }
});
