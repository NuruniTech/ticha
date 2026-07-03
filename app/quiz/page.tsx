"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameSession from "@/components/GameSession";
import { WORD_LISTS, QuizWord } from "@/lib/wordLists";

function QuizContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const game         = searchParams.get("game")    || "animals";
  const lang         = searchParams.get("lang")    || "sw";
  const childId      = searchParams.get("childId") || null;
  const sessionStars = parseInt(searchParams.get("xp") || "0");
  const wordsParam   = searchParams.get("words")   || "";
  const ageParam     = searchParams.get("age");
  const childAge     = ageParam ? parseInt(ageParam) : undefined;

  // If coming from a session, quiz on exactly the words just taught.
  // Fall back to random selection if the param is missing or unresolvable.
  // Lazy useState initializer: the shuffle runs once per mount, keeping
  // render pure and the word set stable across re-renders.
  const [words] = useState<QuizWord[]>(() => {
    const allWords = WORD_LISTS[game] || WORD_LISTS.animals;
    if (wordsParam) {
      const swList = wordsParam.split(",");
      const found  = swList.map(sw => allWords.find(w => w.sw === sw)).filter(Boolean) as QuizWord[];
      if (found.length >= 3) return found;
    }
    return [...allWords].sort(() => Math.random() - 0.5).slice(0, 5);
  });

  return (
    <GameSession
      words={words}
      language={lang}
      childId={childId}
      sessionStars={sessionStars}
      childAge={childAge}
      onComplete={() => router.push(childId ? `/child/${childId}` : "/dashboard")}
    />
  );
}

export default function QuizPage() {
  return <Suspense><QuizContent /></Suspense>;
}
