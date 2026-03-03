import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { palette, typography } from "../styles/theme";

export function KeyboardDoneBar() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const showEvent = "keyboardWillShow";
    const hideEvent = "keyboardWillHide";

    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      Animated.timing(translateY, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true
      }).start();
    };

    const onHide = (e: KeyboardEvent) => {
      Animated.timing(translateY, {
        toValue: 60,
        duration: e.duration || 200,
        useNativeDriver: true
      }).start(() => setKeyboardHeight(0));
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [translateY]);

  if (Platform.OS !== "ios" || keyboardHeight === 0) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: keyboardHeight, transform: [{ translateY }] }
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => Keyboard.dismiss()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: palette.muted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  spacer: {
    flex: 1
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8
  },
  buttonPressed: {
    opacity: 0.6
  },
  buttonText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 16,
    color: palette.primary
  }
});
