"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameSession from "@/components/GameSession";
import { getCourse, resolveWords, resolveWordsByIds, type GameWord } from "@/lib/languages";

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

  // If coming from a session, quiz on exactly the words just taught (the
  // URL carries concept ids). Fall back to a random pick from the category.
  // Lazy useState initializer: the shuffle runs once per mount, keeping
  // render pure and the word set stable across re-renders.
  const [words] = useState<GameWord[]>(() => {
    const course = getCourse(lang);
    if (wordsParam) {
      const found = resolveWordsByIds(wordsParam.split(","), course);
      if (found.length >= 3) return found;
    }
    return [...resolveWords(game, course)].sort(() => Math.random() - 0.5).slice(0, 5);
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
