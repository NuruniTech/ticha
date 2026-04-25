"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuizOverlay from "@/components/QuizOverlay";
import { WORD_LISTS, QuizWord } from "@/lib/wordLists";

function QuizContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const game         = searchParams.get("game")    || "animals";
  const lang         = searchParams.get("lang")    || "sw";
  const childId      = searchParams.get("childId") || null;
  const sessionStars = parseInt(searchParams.get("xp") || "0");
  const wordsParam   = searchParams.get("words")   || "";

  const allWords = WORD_LISTS[game] || WORD_LISTS.animals;

  // If coming from a session, quiz on exactly the words just taught.
  // Fall back to random selection if the param is missing or unresolvable.
  let words: QuizWord[];
  if (wordsParam) {
    const swList = wordsParam.split(",");
    const found  = swList.map(sw => allWords.find(w => w.sw === sw)).filter(Boolean) as QuizWord[];
    words = found.length >= 3 ? found : [...allWords].sort(() => Math.random() - 0.5).slice(0, 5);
  } else {
    words = [...allWords].sort(() => Math.random() - 0.5).slice(0, 5);
  }

  return (
    <QuizOverlay
      words={words}
      language={lang}
      childId={childId}
      sessionStars={sessionStars}
      onComplete={() => router.push(childId ? `/child/${childId}` : "/dashboard")}
    />
  );
}

export default function QuizPage() {
  return <Suspense><QuizContent /></Suspense>;
}
