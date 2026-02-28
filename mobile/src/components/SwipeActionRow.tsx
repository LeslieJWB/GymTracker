import { ReactNode, useMemo, useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

type SwipeActionRowProps = {
  children: ReactNode;
  onAction: () => void;
  disabled?: boolean;
  actionLabel?: string;
  borderRadius?: number;
  marginBottom?: number;
};

const ACTION_WIDTH = 88;
const OPEN_X = -ACTION_WIDTH;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function SwipeActionRow({
  children,
  onAction,
  disabled = false,
  actionLabel = "X",
  borderRadius = 14,
  marginBottom = 0
}: SwipeActionRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffsetRef = useRef(0);
  const actionOpacity = translateX.interpolate({
    inputRange: [OPEN_X, 0],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled) {
            return false;
          }
          return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation((value) => {
            currentOffsetRef.current = value;
          });
        },
        onPanResponderMove: (_event: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          const nextValue = clamp(currentOffsetRef.current + gestureState.dx, OPEN_X, 0);
          translateX.setValue(nextValue);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const endX = clamp(currentOffsetRef.current + gestureState.dx, OPEN_X, 0);
          const shouldOpen = endX < OPEN_X / 2 || gestureState.vx < -0.35;
          const target = shouldOpen ? OPEN_X : 0;
          Animated.spring(translateX, {
            toValue: target,
            useNativeDriver: true,
            bounciness: 0
          }).start(() => {
            currentOffsetRef.current = target;
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0
          }).start(() => {
            currentOffsetRef.current = 0;
          });
        }
      }),
    [disabled, translateX]
  );

  return (
    <View style={[styles.rowWrap, { borderRadius, marginBottom }]}>
      <Animated.View
        style={[
          styles.actionButtonWrap,
          {
            opacity: actionOpacity
          }
        ]}
      >
        <Pressable
          style={[
            styles.actionButton,
            {
              borderTopRightRadius: borderRadius,
              borderBottomRightRadius: borderRadius
            },
            disabled ? styles.actionButtonDisabled : undefined
          ]}
          onPress={() => {
            if (disabled) {
              return;
            }
            onAction();
            Animated.timing(translateX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true
            }).start(() => {
              currentOffsetRef.current = 0;
            });
          }}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={[styles.contentWrap, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    position: "relative",
    overflow: "hidden"
  },
  actionButtonWrap: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    backgroundColor: "#A85448"
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#A85448"
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonText: {
    color: "#FEFEFA",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 18
  },
  contentWrap: {
    zIndex: 1,
    width: "100%"
  }
});
