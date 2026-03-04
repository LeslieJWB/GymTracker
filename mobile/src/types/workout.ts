export type Screen = "calendar" | "record" | "statistics" | "profile";

export type User = {
  id: string;
  username: string;
  displayName: string | null;
  email?: string | null;
  authProvider?: string | null;
};

export type UserProfile = User & {
  heightCm: number | null;
  gender: string | null;
  defaultBodyWeightKg: number | null;
  dailyCalorieTargetKcal: number | null;
  dailyProteinTargetG: number | null;
  dateOfBirth: string | null;
  globalLlmPrompt: string | null;
  profileInitialized: boolean;
};

export type RecordSummary = {
  recordId: string;
  date: string;
  theme: string | null;
  exerciseCount: number;
  setCount: number;
};

export type RecordExerciseSummary = {
  id: string;
  exerciseItemId: string;
  exerciseItemName: string;
  exerciseItemImageUrl: string | null;
  notes: string | null;
  sortOrder: number;
  setCount: number;
  completedVolume: number;
  updatedAt: string;
};

export type RecordDetail = {
  recordId: string;
  date: string;
  userId: string;
  theme: string | null;
  checkInInitialized: boolean;
  dailyCalorieTargetKcal: number | null;
  dailyProteinTargetG: number | null;
  dailyTargetComment: string | null;
  dailyTargetSource: "kimi" | "gemini" | "fallback" | "override" | null;
  exercises: RecordExerciseSummary[];
  foodConsumptions: FoodConsumption[];
  totalCaloriesKcal: number;
  totalProteinG: number;
};

export type FoodConsumptionInputMode = "text" | "text_image" | "image";

export type FoodConsumption = {
  id: string;
  description: string;
  inputMode: FoodConsumptionInputMode;
  caloriesKcal: number;
  proteinG: number;
  comment: string;
  llmSource: string;
  createdAt: string;
  updatedAt: string;
};

export type BodyWeightRecord = {
  date: string;
  weightKg: number;
};

export type AdviceReviewResult = {
  source: "kimi" | "gemini" | "fallback";
  review: string;
};

export type DailyNutritionTargets = {
  source: "kimi" | "gemini" | "fallback" | "override";
  recommendedCaloriesKcal: number;
  recommendedProteinG: number;
  comment: string | null;
};

export type ExerciseDailyMetricsPoint = {
  date: string;
  dailyVolume: number;
  topSetWeight: number;
  topSetVolume: number;
};

export type NutritionDailyPoint = {
  date: string;
  totalCaloriesKcal: number;
  totalProteinG: number;
};

export type ExerciseItem = {
  id: string;
  name: string;
  muscleGroup: string | null;
  imageUrl: string | null;
};

export type ExerciseSet = {
  id: string;
  reps: number;
  weight: number;
  setOrder: number;
  notes: string | null;
  isCompleted: boolean;
};

export type ExerciseDetail = {
  id: string;
  recordId: string;
  exerciseItemId: string;
  exerciseItemName: string;
  exerciseItemImageUrl: string | null;
  notes: string | null;
  sortOrder: number;
  updatedAt: string;
  sets: ExerciseSet[];
};

export type WorkoutTemplateSummary = {
  id: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  updatedAt: string;
};

export type WorkoutTemplateSet = {
  id: string;
  reps: number;
  weight: number;
  setOrder: number;
  notes: string | null;
};

export type WorkoutTemplateExercise = {
  id: string;
  exerciseItemId: string;
  exerciseItemName: string;
  notes: string | null;
  sortOrder: number;
  sets: WorkoutTemplateSet[];
};

export type WorkoutTemplateDetail = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutTemplateExercise[];
};

export type SetDraft = { reps: string; weight: string; notes: string };
export type SetDrafts = Record<string, SetDraft>;
