import { StyleSheet, Text, TouchableOpacity } from "react-native";

type BackButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

export function BackButton({ onPress, disabled = false }: BackButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.buttonDisabled : undefined]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>{"<"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4DCE8"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  icon: {
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "800",
    marginRight: 1
  }
});
