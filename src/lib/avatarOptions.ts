import { Ionicons } from "@expo/vector-icons";

export interface AvatarOption {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export interface AvatarCategory {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  avatars: AvatarOption[];
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    title: "Default",
    icon: "person-outline",
    avatars: [{ id: "default", label: "Default", emoji: "", color: "#dbeafe" }],
  },
  {
    title: "Animals",
    icon: "paw-outline",
    avatars: [
      { id: "fox", label: "Fox", emoji: "🦊", color: "#fed7aa" },
      { id: "panda", label: "Panda", emoji: "🐼", color: "#e0e7ff" },
      { id: "bear", label: "Bear", emoji: "🐻", color: "#fde68a" },
      { id: "rabbit", label: "Rabbit", emoji: "🐰", color: "#fbcfe8" },
      { id: "cat", label: "Cat", emoji: "🐱", color: "#ddd6fe" },
      { id: "tiger", label: "Tiger", emoji: "🐯", color: "#fed7aa" },
      { id: "lion", label: "Lion", emoji: "🦁", color: "#fde68a" },
      { id: "penguin", label: "Penguin", emoji: "🐧", color: "#bfdbfe" },
      { id: "koala", label: "Koala", emoji: "🐨", color: "#d1d5db" },
      { id: "frog", label: "Frog", emoji: "🐸", color: "#bbf7d0" },
      { id: "owl", label: "Owl", emoji: "🦉", color: "#fed7aa" },
      { id: "monkey", label: "Monkey", emoji: "🐵", color: "#fde68a" },
      { id: "raccoon", label: "Raccoon", emoji: "🦝", color: "#e5e7eb" },
      { id: "deer", label: "Deer", emoji: "🦌", color: "#fed7aa" },
      { id: "dolphin", label: "Dolphin", emoji: "🐬", color: "#bae6fd" },
      { id: "shark", label: "Shark", emoji: "🦈", color: "#bfdbfe" },
      { id: "cow", label: "Cow", emoji: "🐮", color: "#f3f4f6" },
      { id: "polar-bear", label: "Polar Bear", emoji: "🐻‍❄️", color: "#f3f4f6" },
      { id: "parrot", label: "Parrot", emoji: "🦜", color: "#fecdd3" },
    ],
  },
  {
    title: "People",
    icon: "people-outline",
    avatars: [
      { id: "person-1", label: "Student 1", emoji: "🧑🏿‍🎓", color: "#bfdbfe" },
      { id: "person-2", label: "Student 2", emoji: "👩🏾‍🎓", color: "#fbcfe8" },
      { id: "person-3", label: "Student 3", emoji: "🧑🏻‍🎓", color: "#bbf7d0" },
      { id: "person-4", label: "Student 4", emoji: "👩🏻‍🎓", color: "#fbcfe8" },
      { id: "person-5", label: "Student 5", emoji: "🧑🏽‍🎓", color: "#bfdbfe" },
      { id: "person-6", label: "Student 6", emoji: "👩🏿‍🎓", color: "#ddd6fe" },
      { id: "person-7", label: "Student 7", emoji: "🧑🏾‍🎓", color: "#fed7aa" },
      { id: "person-8", label: "Student 8", emoji: "👨🏽‍🎓", color: "#bbf7d0" },
      { id: "person-9", label: "Student 9", emoji: "👩🏽‍🎓", color: "#dcfce7" },
      { id: "person-10", label: "Student 10", emoji: "👨🏻‍🎓", color: "#bfdbfe" },
    ],
  },
  {
    title: "Robots & Tech",
    icon: "hardware-chip-outline",
    avatars: [
      { id: "robot-blue", label: "Blue Bot", emoji: "🤖", color: "#bfdbfe" },
      { id: "robot-cyan", label: "Cyan Bot", emoji: "🤖", color: "#a5f3fc" },
      { id: "robot-white", label: "White Bot", emoji: "🤖", color: "#f3f4f6" },
      { id: "robot-green", label: "Green Bot", emoji: "🤖", color: "#bbf7d0" },
      { id: "robot-orange", label: "Orange Bot", emoji: "🤖", color: "#fed7aa" },
      { id: "robot-purple", label: "Purple Bot", emoji: "🤖", color: "#ddd6fe" },
      { id: "robot-pink", label: "Pink Bot", emoji: "🤖", color: "#fbcfe8" },
      { id: "robot-ocean", label: "Ocean Bot", emoji: "🤖", color: "#bae6fd" },
      { id: "robot-gold", label: "Gold Bot", emoji: "🤖", color: "#fde68a" },
      { id: "robot-violet", label: "Violet Bot", emoji: "🤖", color: "#e9d5ff" },
    ],
  },
  {
    title: "Fantasy & Characters",
    icon: "sparkles-outline",
    avatars: [
      { id: "wizard", label: "Wizard", emoji: "🧙", color: "#ddd6fe" },
      { id: "witch", label: "Witch", emoji: "🧙‍♀️", color: "#fbcfe8" },
      { id: "ninja", label: "Ninja", emoji: "🥷", color: "#d1d5db" },
      { id: "superhero", label: "Hero", emoji: "🦸", color: "#bfdbfe" },
      { id: "astronaut", label: "Astronaut", emoji: "🧑‍🚀", color: "#cffafe" },
      { id: "alien", label: "Alien", emoji: "👽", color: "#bbf7d0" },
      { id: "dragon", label: "Dragon", emoji: "🐉", color: "#fecdd3" },
      { id: "viking", label: "Viking", emoji: "🧔", color: "#fed7aa" },
      { id: "pirate", label: "Pirate", emoji: "🏴‍☠️", color: "#fde68a" },
      { id: "princess", label: "Princess", emoji: "👸", color: "#fbcfe8" },
    ],
  },
  {
    title: "Objects & Icons",
    icon: "grid-outline",
    avatars: [
      { id: "lightbulb", label: "Idea", emoji: "💡", color: "#fef3c7" },
      { id: "graduate-cap", label: "Graduate", emoji: "🎓", color: "#bfdbfe" },
      { id: "laptop", label: "Laptop", emoji: "💻", color: "#c7d2fe" },
      { id: "gamepad", label: "Gamer", emoji: "🎮", color: "#ddd6fe" },
      { id: "camera", label: "Camera", emoji: "📷", color: "#fed7aa" },
      { id: "headphones", label: "Music", emoji: "🎧", color: "#bae6fd" },
      { id: "book", label: "Book", emoji: "📗", color: "#bbf7d0" },
      { id: "coffee", label: "Coffee", emoji: "☕", color: "#fed7aa" },
      { id: "rocket", label: "Rocket", emoji: "🚀", color: "#fecdd3" },
      { id: "palette", label: "Palette", emoji: "🎨", color: "#fbcfe8" },
    ],
  },
  {
    title: "Nature & Other",
    icon: "leaf-outline",
    avatars: [
      { id: "sun", label: "Sun", emoji: "🌞", color: "#fde68a" },
      { id: "moon", label: "Moon", emoji: "🌙", color: "#c7d2fe" },
      { id: "mountain", label: "Mountain", emoji: "🏔️", color: "#bae6fd" },
      { id: "cactus", label: "Cactus", emoji: "🌵", color: "#bbf7d0" },
      { id: "tree", label: "Tree", emoji: "🌳", color: "#dcfce7" },
      { id: "wave", label: "Wave", emoji: "🌊", color: "#bae6fd" },
      { id: "island", label: "Island", emoji: "🏝️", color: "#fed7aa" },
      { id: "snowflake", label: "Snowflake", emoji: "❄️", color: "#e0f2fe" },
      { id: "rainbow", label: "Rainbow", emoji: "🌈", color: "#fbcfe8" },
      { id: "heart", label: "Heart", emoji: "❤️", color: "#fecdd3" },
    ],
  },
];

export const AVATAR_OPTIONS: AvatarOption[] = [
  AVATAR_CATEGORIES[0].avatars[0],
  ...AVATAR_CATEGORIES.slice(1).flatMap((category) => category.avatars),
];

export function getAvatarOption(avatarId?: string | null): AvatarOption {
  return AVATAR_OPTIONS.find((avatar) => avatar.id === avatarId) ?? AVATAR_OPTIONS[0];
}
