export const CARDIO_CATEGORY = "cardio";
export const STRENGTH_CATEGORIES = [
    "strength",
    "powerlifting",
    "olympic weightlifting",
    "strongman",
    "plyometrics"
];
export function isStrengthCategory(category) {
    if (!category) {
        return false;
    }
    return STRENGTH_CATEGORIES.includes(category);
}
export function isCardioCategory(category) {
    return category === CARDIO_CATEGORY;
}
