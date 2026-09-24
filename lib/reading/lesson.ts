// Chooses what one lesson contains. Pure and deterministic: same attempts in,
// same plan out — which keeps it testable and keeps the app, not the AI, in
// charge of progression.

import { READING_ITEMS, getItem, isKnownItemId } from "./curriculum";
import { correctCount, itemState, lastAttemptAt, type Attempt } from "./mastery";

export interface LessonPlan {
  review: string[]; // up to 2 already-mastered items, least recently seen first
  teach: string[];  // up to 3 items (5 while teaching the vowels): new ones first, topped up with ones still being learned
  mixed: string[];  // closing round: the same items in a different (reversed) order
}

const MAX_REVIEW = 2;
const MAX_TEACH = 3;
const MAX_TEACH_VOWELS = 5; // the five vowels are taught together, as one small set
const MAX_LEARNING_AT_ONCE = 6; // do not pile on new items while many are shaky
const WORD_PREREQ_CORRECT = 2;  // a word opens when each of its syllables has this many correct

export function planLesson(attemptsByItem: Record<string, Attempt[]>): LessonPlan {
  const attempts = (id: string) => attemptsByItem[id] ?? [];
  const known = READING_ITEMS.filter((i) => isKnownItemId(i.id));

  const mastered = known.filter((i) => itemState(attempts(i.id)) === "mastered");
  const learning = known.filter((i) => itemState(attempts(i.id)) === "learning");

  const review = [...mastered]
    .sort((x, y) => lastAttemptAt(attempts(x.id)) - lastAttemptAt(attempts(y.id)))
    .slice(0, MAX_REVIEW)
    .map((i) => i.id);

  const isReadable = (id: string) => {
    const item = getItem(id)!;
    return item.requires.every((r) => correctCount(attempts(r)) >= WORD_PREREQ_CORRECT);
  };

  const teach: string[] = [];
  const firstNew = known.find((i) => itemState(attempts(i.id)) === "unseen" && isReadable(i.id));
  const maxTeach = firstNew?.kind === "vowel" ? MAX_TEACH_VOWELS : MAX_TEACH;
  if (learning.length < MAX_LEARNING_AT_ONCE) {
    for (const item of known) {
      if (teach.length >= maxTeach) break;
      if (itemState(attempts(item.id)) === "unseen" && isReadable(item.id)) teach.push(item.id);
    }
  }
  // Top up with items still being learned, most recently practised first.
  const practise = [...learning].sort((x, y) => lastAttemptAt(attempts(y.id)) - lastAttemptAt(attempts(x.id)));
  for (const item of practise) {
    if (teach.length >= maxTeach) break;
    if (!teach.includes(item.id)) teach.push(item.id);
  }

  const mixed = [...teach, ...review].reverse();
  return { review, teach, mixed };
}
