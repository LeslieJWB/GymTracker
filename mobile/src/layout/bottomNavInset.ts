import type { EdgeInsets } from "react-native-safe-area-context";

const BOTTOM_NAV_ISLAND_HEIGHT = 52;

/** Sit just above the home indicator on notched iPhones; modest offset elsewhere. */
export function bottomNavBarBottomOffset(insets: EdgeInsets): number {
  return insets.bottom > 0 ? Math.max(12, insets.bottom - 16) : 12;
}

/** Scroll inset so the last items can clear the floating nav — not layout padding. */
export function bottomNavScrollInset(insets: EdgeInsets): number {
  const barBottom = bottomNavBarBottomOffset(insets);
  return BOTTOM_NAV_ISLAND_HEIGHT + barBottom + Math.max(insets.bottom, 16);
}
