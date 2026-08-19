// =====================================================================
// Kininaru Planner — Journal Studio Stickers (Enhanced)
// =====================================================================

import type { StickerCategory } from './types';

export interface Sticker {
  id: string;
  emoji: string;
  category: StickerCategory;
}

export const STICKER_CATEGORIES: { id: StickerCategory; name: string; icon: string }[] = [
  { id: 'cute', name: 'Mignon', icon: '🌸' },
  { id: 'kawaii', name: 'Kawaii', icon: '🩷' },
  { id: 'aesthetic', name: 'Aesthetic', icon: '🫧' },
  { id: 'study', name: 'Études', icon: '📚' },
  { id: 'productivity', name: 'Productivité', icon: '⚡' },
  { id: 'emotions', name: 'Émotions', icon: '😊' },
  { id: 'nature', name: 'Nature', icon: '🌿' },
  { id: 'stars', name: 'Étoiles', icon: '⭐' },
  { id: 'plants', name: 'Plantes', icon: '🌱' },
  { id: 'food', name: 'Nourriture', icon: '🍕' },
  { id: 'travel', name: 'Voyage', icon: '✈️' },
  { id: 'celebration', name: 'Célébration', icon: '🎉' },
  { id: 'romantic', name: 'Romantique', icon: '💕' },
  { id: 'music', name: 'Musique', icon: '🎵' },
  { id: 'books', name: 'Livres', icon: '📖' },
  { id: 'selfcare', name: 'Bien-être', icon: '🫶' },
  { id: 'seasonal', name: 'Saison', icon: '🍂' },
  { id: 'minimal', name: 'Minimal', icon: '✨' },
];

export const STICKERS: Sticker[] = [
  // ---- Cute ----
  { id: 'flower-1', emoji: '🌸', category: 'cute' },
  { id: 'flower-2', emoji: '🌺', category: 'cute' },
  { id: 'flower-3', emoji: '🌷', category: 'cute' },
  { id: 'butterfly', emoji: '🦋', category: 'cute' },
  { id: 'rainbow', emoji: '🌈', category: 'cute' },
  { id: 'sparkle', emoji: '✨', category: 'cute' },
  { id: 'heart', emoji: '💖', category: 'cute' },
  { id: 'star-cute', emoji: '⭐', category: 'cute' },
  { id: 'moon', emoji: '🌙', category: 'cute' },
  { id: 'sun', emoji: '☀️', category: 'cute' },
  { id: 'cloud', emoji: '☁️', category: 'cute' },
  { id: 'bow', emoji: '🎀', category: 'cute' },
  { id: 'ribbon-cute', emoji: '💝', category: 'cute' },
  { id: 'clover', emoji: '🍀', category: 'cute' },

  // ---- Kawaii (original, no copyrighted characters) ----
  { id: 'kawaii-star', emoji: '🌟', category: 'kawaii' },
  { id: 'kawaii-heart', emoji: '💗', category: 'kawaii' },
  { id: 'kawaii-sparkles', emoji: '💫', category: 'kawaii' },
  { id: 'kawaii-bounce', emoji: '🩷', category: 'kawaii' },
  { id: 'kawaii-bear', emoji: '🧸', category: 'kawaii' },
  { id: 'kawaii-bunny', emoji: '🐰', category: 'kawaii' },
  { id: 'kawaii-cat', emoji: '🐱', category: 'kawaii' },
  { id: 'kawaii-paw', emoji: '🐾', category: 'kawaii' },
  { id: 'kawaii-baby', emoji: '🪷', category: 'kawaii' },
  { id: 'kawaii-cloud', emoji: '🫧', category: 'kawaii' },
  { id: 'kawaii-candy', emoji: '🍬', category: 'kawaii' },
  { id: 'kawaii-cupcake', emoji: '🧁', category: 'kawaii' },

  // ---- Aesthetic ----
  { id: 'aesthetic-camera', emoji: '📷', category: 'aesthetic' },
  { id: 'aesthetic-polaroid', emoji: '🖼️', category: 'aesthetic' },
  { id: 'aesthetic-candle', emoji: '🕯️', category: 'aesthetic' },
  { id: 'aesthetic-diamond', emoji: '💎', category: 'aesthetic' },
  { id: 'aesthetic-feather', emoji: '🪶', category: 'aesthetic' },
  { id: 'aesthetic-shell', emoji: '🐚', category: 'aesthetic' },
  { id: 'aesthetic-ribbon', emoji: '🎀', category: 'aesthetic' },
  { id: 'aesthetic-pearl', emoji: '🪩', category: 'aesthetic' },
  { id: 'aesthetic-envelope', emoji: '💌', category: 'aesthetic' },
  { id: 'aesthetic-locket', emoji: '🩵', category: 'aesthetic' },

  // ---- Study ----
  { id: 'book', emoji: '📖', category: 'study' },
  { id: 'books', emoji: '📚', category: 'study' },
  { id: 'pen-study', emoji: '🖊️', category: 'study' },
  { id: 'pencil', emoji: '✏️', category: 'study' },
  { id: 'notebook', emoji: '📓', category: 'study' },
  { id: 'graduation', emoji: '🎓', category: 'study' },
  { id: 'lightbulb', emoji: '💡', category: 'study' },
  { id: 'brain', emoji: '🧠', category: 'study' },
  { id: 'microscope', emoji: '🔬', category: 'study' },
  { id: 'calculator', emoji: '🧮', category: 'study' },
  { id: 'clipboard', emoji: '📋', category: 'study' },
  { id: 'ruler', emoji: '📐', category: 'study' },

  // ---- Productivity ----
  { id: 'rocket', emoji: '🚀', category: 'productivity' },
  { id: 'target', emoji: '🎯', category: 'productivity' },
  { id: 'check', emoji: '✅', category: 'productivity' },
  { id: 'calendar', emoji: '📅', category: 'productivity' },
  { id: 'clock', emoji: '⏰', category: 'productivity' },
  { id: 'timer', emoji: '⏱️', category: 'productivity' },
  { id: 'trophy', emoji: '🏆', category: 'productivity' },
  { id: 'medal', emoji: '🏅', category: 'productivity' },
  { id: 'fire', emoji: '🔥', category: 'productivity' },
  { id: 'muscle', emoji: '💪', category: 'productivity' },
  { id: 'lightning', emoji: '⚡', category: 'productivity' },
  { id: 'star-prod', emoji: '🌟', category: 'productivity' },

  // ---- Emotions ----
  { id: 'happy', emoji: '😊', category: 'emotions' },
  { id: 'love', emoji: '😍', category: 'emotions' },
  { id: 'hug', emoji: '🤗', category: 'emotions' },
  { id: 'wink', emoji: '😉', category: 'emotions' },
  { id: 'cool', emoji: '😎', category: 'emotions' },
  { id: 'thinking', emoji: '🤔', category: 'emotions' },
  { id: 'sleepy', emoji: '😴', category: 'emotions' },
  { id: 'excited', emoji: '🤩', category: 'emotions' },
  { id: 'peace', emoji: '☮️', category: 'emotions' },
  { id: 'zen', emoji: '🧘', category: 'emotions' },
  { id: 'pray', emoji: '🙏', category: 'emotions' },
  { id: 'clap', emoji: '👏', category: 'emotions' },

  // ---- Nature ----
  { id: 'tree', emoji: '🌳', category: 'nature' },
  { id: 'leaf', emoji: '🍃', category: 'nature' },
  { id: 'mountain', emoji: '⛰️', category: 'nature' },
  { id: 'ocean', emoji: '🌊', category: 'nature' },
  { id: 'sunset', emoji: '🌅', category: 'nature' },
  { id: 'snowflake', emoji: '❄️', category: 'nature' },
  { id: 'fire-nature', emoji: '🔥', category: 'nature' },
  { id: 'sparkle-nature', emoji: '✨', category: 'nature' },
  { id: 'moon-nature', emoji: '🌙', category: 'nature' },
  { id: 'sun-nature', emoji: '☀️', category: 'nature' },
  { id: 'cloud-nature', emoji: '☁️', category: 'nature' },
  { id: 'rain', emoji: '🌧️', category: 'nature' },
  { id: 'rainbow-nature', emoji: '🌈', category: 'nature' },

  // ---- Stars ----
  { id: 'star-1', emoji: '⭐', category: 'stars' },
  { id: 'star-2', emoji: '🌟', category: 'stars' },
  { id: 'star-3', emoji: '💫', category: 'stars' },
  { id: 'star-4', emoji: '🌠', category: 'stars' },
  { id: 'star-5', emoji: '🎇', category: 'stars' },
  { id: 'star-6', emoji: '🎆', category: 'stars' },
  { id: 'star-7', emoji: '✨', category: 'stars' },
  { id: 'star-8', emoji: '⚡', category: 'stars' },
  { id: 'star-9', emoji: '💥', category: 'stars' },

  // ---- Plants ----
  { id: 'seedling', emoji: '🌱', category: 'plants' },
  { id: 'cactus', emoji: '🌵', category: 'plants' },
  { id: 'flower-plants', emoji: '🌸', category: 'plants' },
  { id: 'tulip', emoji: '🌷', category: 'plants' },
  { id: 'rose', emoji: '🌹', category: 'plants' },
  { id: 'tree-plants', emoji: '🌳', category: 'plants' },
  { id: 'leaf-plants', emoji: '🍃', category: 'plants' },
  { id: 'herb', emoji: '🌿', category: 'plants' },
  { id: 'mushroom', emoji: '🍄', category: 'plants' },
  { id: 'palm', emoji: '🌴', category: 'plants' },
  { id: 'bonsai', emoji: '🪴', category: 'plants' },
  { id: 'bamboo', emoji: '🎋', category: 'plants' },

  // ---- Food ----
  { id: 'pizza', emoji: '🍕', category: 'food' },
  { id: 'coffee', emoji: '☕', category: 'food' },
  { id: 'tea', emoji: '🍵', category: 'food' },
  { id: 'cake', emoji: '🎂', category: 'food' },
  { id: 'cookie', emoji: '🍪', category: 'food' },
  { id: 'apple', emoji: '🍎', category: 'food' },
  { id: 'banana', emoji: '🍌', category: 'food' },
  { id: 'grape', emoji: '🍇', category: 'food' },
  { id: 'cherry', emoji: '🍒', category: 'food' },
  { id: 'ice-cream', emoji: '🍦', category: 'food' },
  { id: 'chocolate', emoji: '🍫', category: 'food' },
  { id: 'wine', emoji: '🍷', category: 'food' },

  // ---- Travel ----
  { id: 'airplane', emoji: '✈️', category: 'travel' },
  { id: 'globe', emoji: '🌍', category: 'travel' },
  { id: 'map', emoji: '🗺️', category: 'travel' },
  { id: 'compass', emoji: '🧭', category: 'travel' },
  { id: 'camera', emoji: '📸', category: 'travel' },
  { id: 'suitcase', emoji: '🧳', category: 'travel' },
  { id: 'beach', emoji: '🏖️', category: 'travel' },
  { id: 'mountain-travel', emoji: '🏔️', category: 'travel' },
  { id: 'temple', emoji: '⛩️', category: 'travel' },
  { id: 'ferris-wheel', emoji: '🎡', category: 'travel' },
  { id: 'tent', emoji: '⛺', category: 'travel' },
  { id: 'cruise', emoji: '🚢', category: 'travel' },

  // ---- Celebration ----
  { id: 'party', emoji: '🎉', category: 'celebration' },
  { id: 'balloon', emoji: '🎈', category: 'celebration' },
  { id: 'confetti', emoji: '🎊', category: 'celebration' },
  { id: 'gift', emoji: '🎁', category: 'celebration' },
  { id: 'crown', emoji: '👑', category: 'celebration' },
  { id: 'champagne', emoji: '🍾', category: 'celebration' },
  { id: 'fireworks', emoji: '🎆', category: 'celebration' },
  { id: 'sparkler', emoji: '🎇', category: 'celebration' },
  { id: 'confetti-ball', emoji: '🥳', category: 'celebration' },
  { id: 'party-popper', emoji: '🪅', category: 'celebration' },

  // ---- Romantic ----
  { id: 'romantic-heart', emoji: '💕', category: 'romantic' },
  { id: 'romantic-couple', emoji: '👩‍❤️‍👨', category: 'romantic' },
  { id: 'romantic-kiss', emoji: '💋', category: 'romantic' },
  { id: 'romantic-rose', emoji: '🌹', category: 'romantic' },
  { id: 'romantic-letter', emoji: '💌', category: 'romantic' },
  { id: 'romantic-sparkle', emoji: '✨', category: 'romantic' },
  { id: 'romantic-ring', emoji: '💍', category: 'romantic' },
  { id: 'romantic-locket', emoji: '💝', category: 'romantic' },
  { id: 'romantic-candle', emoji: '🕯️', category: 'romantic' },

  // ---- Music ----
  { id: 'music-note', emoji: '🎵', category: 'music' },
  { id: 'music-notes', emoji: '🎶', category: 'music' },
  { id: 'music-headphones', emoji: '🎧', category: 'music' },
  { id: 'music-guitar', emoji: '🎸', category: 'music' },
  { id: 'music-piano', emoji: '🎹', category: 'music' },
  { id: 'music-mic', emoji: '🎤', category: 'music' },
  { id: 'music-dance', emoji: '💃', category: 'music' },
  { id: 'music-cd', emoji: '💿', category: 'music' },

  // ---- Books ----
  { id: 'books-stack', emoji: '📚', category: 'books' },
  { id: 'books-open', emoji: '📖', category: 'books' },
  { id: 'books-bookmark', emoji: '🔖', category: 'books' },
  { id: 'books-quill', emoji: '🪶', category: 'books' },
  { id: 'books-scroll', emoji: '📜', category: 'books' },
  { id: 'books-comic', emoji: '📰', category: 'books' },
  { id: 'books-library', emoji: '🏛️', category: 'books' },

  // ---- Self-care ----
  { id: 'selfcare-bath', emoji: '🛁', category: 'selfcare' },
  { id: 'selfcare-candle', emoji: '🕯️', category: 'selfcare' },
  { id: 'selfcare-leaf', emoji: '🍃', category: 'selfcare' },
  { id: 'selfcare-yoga', emoji: '🧘', category: 'selfcare' },
  { id: 'selfcare-tea', emoji: '🍵', category: 'selfcare' },
  { id: 'selfcare-heart', emoji: '🫶', category: 'selfcare' },
  { id: 'selfcare-spa', emoji: '💆', category: 'selfcare' },
  { id: 'selfcare-sleep', emoji: '😴', category: 'selfcare' },
  { id: 'selfcare-bloom', emoji: '🪻', category: 'selfcare' },

  // ---- Seasonal ----
  { id: 'seasonal-leaf', emoji: '🍂', category: 'seasonal' },
  { id: 'seasonal-snowman', emoji: '⛄', category: 'seasonal' },
  { id: 'seasonal-sun', emoji: '🌞', category: 'seasonal' },
  { id: 'seasonal-flower', emoji: '🌸', category: 'seasonal' },
  { id: 'seasonal-umbrella', emoji: '☂️', category: 'seasonal' },
  { id: 'seasonal-pumpkin', emoji: '🎃', category: 'seasonal' },
  { id: 'seasonal-cherry', emoji: '🍒', category: 'seasonal' },
  { id: 'seasonal-maple', emoji: '🍁', category: 'seasonal' },

  // ---- Minimal ----
  { id: 'dot', emoji: '•', category: 'minimal' },
  { id: 'circle-min', emoji: '○', category: 'minimal' },
  { id: 'square-min', emoji: '□', category: 'minimal' },
  { id: 'triangle-min', emoji: '△', category: 'minimal' },
  { id: 'diamond-min', emoji: '◇', category: 'minimal' },
  { id: 'star-min', emoji: '☆', category: 'minimal' },
  { id: 'heart-min', emoji: '♡', category: 'minimal' },
  { id: 'arrow-right', emoji: '→', category: 'minimal' },
  { id: 'arrow-down', emoji: '↓', category: 'minimal' },
  { id: 'check-min', emoji: '✓', category: 'minimal' },
  { id: 'cross', emoji: '✗', category: 'minimal' },
  { id: 'plus', emoji: '+', category: 'minimal' },
];

export function getStickersByCategory(category: StickerCategory): Sticker[] {
  return STICKERS.filter(s => s.category === category);
}

export function getStickerById(id: string): Sticker | undefined {
  return STICKERS.find(s => s.id === id);
}
