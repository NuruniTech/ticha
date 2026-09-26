// A "sound friend": each sound the child gets right earns a friendly animal sticker
// for Ticha's sound book. Children respond to something they can see and collect
// straight away far more than to an abstract progress bar (real progress numbers
// live on the parent page). The animal for a sound is fixed, so a child always
// meets the same friend for the same sound.

import { getItem } from "./curriculum";

export const SOUND_FRIENDS = ["🦁", "🐘", "🦒", "🐒", "🦓", "🐢", "🦜", "🐸", "🦋", "🐠", "🐧", "🦉"] as const;

export function friendFor(itemId: string): string {
  const step = getItem(itemId)?.step ?? 0;
  return SOUND_FRIENDS[step % SOUND_FRIENDS.length];
}
