import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { FocusedInputEvents, KeyboardProvider, KeyboardToolbar, useKeyboardState } from "react-native-keyboard-controller";

type KeyboardSystemContextValue = {
  keyboardVisible: boolean;
  focusedInputCurrent: number;
  toolbarEnabled: boolean;
  toolbarSuppressed: boolean;
  setToolbarSuppressed: (suppressed: boolean) => void;
};

const KeyboardSystemContext = createContext<KeyboardSystemContextValue | null>(null);

type KeyboardSystemProviderProps = {
  children: ReactNode;
};

export function KeyboardSystemProvider({ children }: KeyboardSystemProviderProps) {
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const [focusedInputCurrent, setFocusedInputCurrent] = useState(-1);
  const [toolbarSuppressed, setToolbarSuppressed] = useState(false);

  useEffect(() => {
    const subscription = FocusedInputEvents.addListener("focusDidSet", (e) => {
      setFocusedInputCurrent(e.current);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const toolbarEnabled = Platform.OS === "ios" && !toolbarSuppressed && (keyboardVisible || focusedInputCurrent >= 0);

  const value = useMemo<KeyboardSystemContextValue>(
    () => ({
      keyboardVisible,
      focusedInputCurrent,
      toolbarEnabled,
      toolbarSuppressed,
      setToolbarSuppressed
    }),
    [focusedInputCurrent, keyboardVisible, toolbarEnabled, toolbarSuppressed]
  );

  return (
    <KeyboardProvider>
      <KeyboardSystemContext.Provider value={value}>
        {children}
        {Platform.OS === "ios" ? <KeyboardToolbar enabled={toolbarEnabled} /> : null}
      </KeyboardSystemContext.Provider>
    </KeyboardProvider>
  );
}

export function useKeyboardSystem(): KeyboardSystemContextValue {
  const context = useContext(KeyboardSystemContext);
  if (!context) {
    throw new Error("useKeyboardSystem must be used within KeyboardSystemProvider.");
  }
  return context;
}
