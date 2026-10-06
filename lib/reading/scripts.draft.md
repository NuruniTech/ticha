# Vowels lesson — script draft for review

Every line Ticha will actually speak, written exactly as it will be said. Please
correct wording directly — natural phrasing for a small child matters more than
matching my draft literally. Lines marked **(variant N of M)** are alternatives
rotated randomly so repeated moments don't feel robotic; all variants in a set
should carry the same meaning.

Anchor words confirmed: a=asali (honey), e=embe (mango), i=ini (liver), o=oga
(bathe), u=uji (porridge).

---

## Opening

**greeting** *(name inserted live — the one line generated on-the-fly, not pre-cached)*
> Hujambo {name}! Nimefurahi sana kukuona leo.

**warmup_feeling** *(fixed)*
> Unajisikiaje leo, {name}?

**warmup_feeling_reaction** *(templated by answer — covers common feeling-words; falls back to warmup_feeling_reaction_fallback if the answer doesn't match any)*
- "nzuri" / "vizuri" / "salama" → "Ni vizuri sana kusikia hivyo!"
- "sijambo" → "Safi kabisa!"
- "mchovu" / "nimechoka" → "Pole sana. Tutacheza kwa polepole leo."
- "Nzuri" → "Nimefurahi!"
- fallback → "Asante kwa kuniambia hivyo!"

**warmup_question** *(one of 3, picked at random — matches existing FUN_QUESTIONS)*
- (variant 1 of 3) "Ni mnyama gani unampenda zaidi kuliko wengine?" (favourite animal)
- (variant 2 of 3) "Umekula kitu gani kizuri leo?" (something yummy eaten today)
- (variant 3 of 3) "Ni rangi gani unaipenda zaidi?" (favourite colour)

**warmup_question_reaction** *(templated by category + answer keyword; falls back to warmup_question_reaction_fallback)*
- animal words (simba, tembo, paka, mbwa, ndege, ...) → "{animal} ni mnyama mzuri sana!"
- food words (ndizi, embe, ugali, wali, ...) → "{food} ni kitamu kweli!"
- colour words (nyekundu, buluu, kijani, ...) → "{colour} ni rangi nzuri sana!"
- fallback → "Hiyo ni nzuri sana!"

**ready_check** *(fixed — closes the warmup, announces the lesson, checks readiness)*
> Safi! Leo utajifunza sauti nzuri za kufurahisha. Je, uko tayari?

---

## Class intro — said once, before the first vowel

**class_intro** *(fixed, vowels only)*
> Leo tutakutana na marafiki watano maalum. Wanaitwa irabu: a, e, i, o, u. Tutawajua mmoja mmoja, tukianza na huyu.

---

## Per-vowel teaching (one set of 3 lines × 5 vowels = 15 lines)

**teach_model_{vowel}** *(fixed, one per vowel — names the sound and gives the anchor word)*
- a → "Hii ni a. Ni sauti ya kwanza katika neno 'asali'. Sikiliza: aaa."
- e → "Hii ni e. Ni sauti ya kwanza katika neno 'embe'. Sikiliza: eee."
- i → "Hii ni i. Ni sauti ya kwanza katika neno 'ini'. Sikiliza: iii."
- o → "Hii ni o. Ni sauti ya kwanza katika neno 'oga'. Sikiliza: ooo."
- u → "Hii ni u. Ni sauti ya kwanza katika neno 'uji'. Sikiliza: uuu."

**together_intro** *(fixed, ONE shared line, not vowel-specific — invites the child and checks readiness before any timing starts)*
> Tuseme pamoja. Nahesabu mpaka tatu, alafu tuseme pamoja. Uko tayari?

*(the app then waits for the child to respond at all — any answer or a short timeout — same as the existing together-stage handling, not a parsed "yes"; this is what gives the child a real moment to be heard before the countdown, which plain "let's say it together, [vowel]" never did)*

**together_count_{vowel}** *(fixed, one per vowel — the actual synchronised moment: a counted cue for exactly when to join in, replacing the old "Twende pamoja" which gave the child no signal for WHEN to speak along)*
- a → "Moja, mbili, tatu... aaa!"
- e → "Moja, mbili, tatu... eee!"
- i → "Moja, mbili, tatu... iii!"
- o → "Moja, mbili, tatu... ooo!"
- u → "Moja, mbili, tatu... uuu!"

**teach_alone** *(fixed, ONE shared line reused for every vowel — the screen shows which vowel, so the audio doesn't need to repeat it)*
> Sasa ni zamu yako. Jaribu kusema peke yako.

**teach_play_{idea}** *(4 variants, shared across vowels — the screen shows which vowel)*
- (variant 1 of 4) "Tuseme kwa sauti ya panya mdogo... alafu kwa sauti ya simba mkubwa!"
- (variant 2 of 4) "Tuseme polepole kama konokono... alafu haraka kama sungura!"
- (variant 3 of 4) "Tunong'one kama siri... alafu tuseme kwa sauti kubwa!"
- (variant 4 of 4) "Tupige makofi mara moja tunaposema!"

---

## Feedback (shared across every item, not vowel-specific — reused everywhere)

**praise** *(6 variants, picked at random — matches existing PRAISES)*
1. "Vizuri sana!"
2. "Hongera sana!"
3. "Safi kabisa!"
4. "Umefanya vizuri!"
5. "Ndiyo, ni sahihi!"
6. "Vizuri kabisa, wewe una akili sana!"

**retry_incorrect** *(1-2 variants — said after a wrong try, before listening again)*
1. "Umekosea kidogo sana. Embu tusikilize tena pamoja."
2. "Safi! Sasa jaribu tena."

**retry_unscored** *(said when nothing was heard clearly)*
> Sijakusikia vizuri. Sema tena, tafadhali.

**moved_on_after_miss** *(said after the tries are used up and it's time to move on, without revealing the answer)*
> Ni sawa, tutajaribu tena siku nyingine.

**check_neutral** *(said after every check/baseline item — never reveals correctness)*
> Asante!

**check_discontinue** *(said when a check stops early after repeated misses)*
> Asante sana kwa kujaribu. Tumemaliza mchezo huu, na umefanya vizuri sana leo.

---

## Closing round ("mixed")

**mixed_intro** *(fixed, vowels only — the chant, then announces the game)*
> Twende pamoja: a, e, i, o, u! Sasa tutacheza na vyote tulivyojifunza leo, kama sherehe ndogo!

**lesson_end** *(name inserted live, like the greeting — generic content, does not enumerate specific sounds learned; see design doc for why)*
> Umefanya kazi nzuri sana leo, {name}! Ninajivunia sana kuwa mwalimu wako. Tutaonana tena!

---

**Total new audio files needed: ~34** (1 shared `teach_alone` + 5+5 per-vowel
teach lines + 4 play variants + 6 praise + 2 retry-incorrect + 1 retry-unscored
+ 1 moved-on + 1 check-neutral + 1 check-discontinue + 1 class-intro + 1
mixed-intro + 1 lesson-end + 1 ready-check + 1 warmup-feeling + 3
warmup-question + ~8 reaction templates). Greeting and lesson-end-with-name
are the only name-dependent lines, generated live.
