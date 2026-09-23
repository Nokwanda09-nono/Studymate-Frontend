export const INITIAL_STUDY_POINTS = 1000;
export const MISSED_SESSION_DEDUCTION = 25;
export const LOW_POINTS_THRESHOLD = 100;
export const ACCOUNT_DELETION_THRESHOLD = 0;

export type StudyTier = "bronze" | "silver" | "gold" | "platinum";

export interface StudyTierDetails {
  name: StudyTier;
  label: string;
  minimumPoints: number;
  colors: [string, string, string];
}

export const STUDY_TIERS: StudyTierDetails[] = [
  {
    name: "platinum",
    label: "Platinum",
    minimumPoints: 800,
    colors: ["#dbeafe", "#38bdf8", "#2563eb"],
  },
  {
    name: "gold",
    label: "Gold",
    minimumPoints: 500,
    colors: ["#fff7ad", "#fbbf24", "#d97706"],
  },
  {
    name: "silver",
    label: "Silver",
    minimumPoints: 250,
    colors: ["#f8fafc", "#cbd5e1", "#64748b"],
  },
  {
    name: "bronze",
    label: "Bronze",
    minimumPoints: 0,
    colors: ["#fed7aa", "#c2410c", "#7c2d12"],
  },
];

export const getStudyTier = (points: number): StudyTierDetails => {
  return (
    STUDY_TIERS.find((tier) => points >= tier.minimumPoints) ||
    STUDY_TIERS[STUDY_TIERS.length - 1]
  );
};

export const clampStudyPoints = (points: number): number => {
  return Math.max(ACCOUNT_DELETION_THRESHOLD, Math.round(points));
};
