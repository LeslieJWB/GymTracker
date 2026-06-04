import type { PurchasesPackage } from "react-native-purchases";

const PACKAGE_PERIOD_LABELS: Record<string, string> = {
  WEEKLY: "1 week",
  MONTHLY: "1 month",
  TWO_MONTH: "2 months",
  THREE_MONTH: "3 months",
  SIX_MONTH: "6 months",
  ANNUAL: "1 year"
};

export function formatSubscriptionPeriod(pkg: PurchasesPackage): string {
  const packageType = String(pkg.packageType);
  if (PACKAGE_PERIOD_LABELS[packageType]) {
    return PACKAGE_PERIOD_LABELS[packageType];
  }

  const identifier = pkg.identifier.toLowerCase();
  if (identifier.includes("week")) {
    return "1 week";
  }
  if (identifier.includes("month")) {
    return "1 month";
  }
  if (identifier.includes("year") || identifier.includes("annual")) {
    return "1 year";
  }

  return "Auto-renewing";
}

export function formatSubscriptionPriceLine(pkg: PurchasesPackage): string {
  const period = formatSubscriptionPeriod(pkg);
  return `${pkg.product.priceString} / ${period}`;
}
