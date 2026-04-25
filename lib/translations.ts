import { Lang } from "@/context/LanguageContext";

interface Translations {
  offline: {
    banner: string;
    sessionTitle: string;
    sessionDesc: string;
    sessionBack: string;
    cachedData: string;
  };
  landing: {
    navLogin: string;
    navGetStarted: string;
    heroTitle: string;
    heroTitleHighlight: string;
    heroSubtitle: string;
    heroLanguageNote: string;
    heroLanguageSub: string;
    heroCta: string;
    heroLogin: string;
    heroFine: string;
    languagesTitle: string;
    available: string;
    comingSoon: string;
    featuresTitle: string;
    featuresSub: string;
    features: { title: string; desc: string }[];
    howTitle: string;
    howSub: string;
    howSteps: { title: string; desc: string }[];
    missionLabel: string;
    missionNonprofit: string;
    missionRegistered: string;
    missionTitleLine1: string;
    missionHighlight: string;
    missionTitleLine2: string;
    missionDesc1: string;
    missionDesc2: string;
    missionQuote: string;
    whoTitle: string;
    whoSub: string;
    whoCards: { title: string; desc: string }[];
    ctaTitle: string;
    ctaSub: string;
    ctaButton: string;
    ctaLogin: string;
    footerCopy: string;
    footerSub: string;
    footerPrivacy: string;
    footerTerms: string;
  };
  login: {
    title: string;
    subtitle: string;
    google: string;
    googleRedirecting: string;
    orEmail: string;
    emailLabel: string;
    passwordLabel: string;
    forgotPassword: string;
    showPassword: string;
    hidePassword: string;
    loggingIn: string;
    loginBtn: string;
    noAccount: string;
    signUpFree: string;
    resetTitle: string;
    resetSubtitle: string;
    emailAddressLabel: string;
    sending: string;
    sendResetLink: string;
    backToLogin: string;
    checkInbox: string;
    resetSentTo: (email: string) => string;
    backToLoginBtn: string;
    errors: {
      authFailed: string;
      wrongCredentials: string;
      confirmEmail: string;
      rateLimit: string;
      connection: string;
      enterEmail: string;
    };
  };
  signup: {
    title: string;
    subtitle: string;
    google: string;
    googleRedirecting: string;
    orEmail: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    passwordStrength: { weak: string; fair: string; good: string; strong: string };
    creating: string;
    createBtn: string;
    alreadyAccount: string;
    loginLink: string;
    privacyNote: string;
    confirmTitle: string;
    confirmSentTo: (email: string) => string;
    confirmInstructions: string;
    goToLogin: string;
    noEmail: string;
    errors: {
      enterName: string;
      passwordShort: string;
      emailExists: string;
      passwordWeak: string;
      invalidEmail: string;
      rateLimit: string;
      connection: string;
    };
  };
  dashboard: {
    loading: string;
    connectionProblem: string;
    connectionError: string;
    tryAgain: string;
    welcome: (name: string) => string;
    noChildren: string;
    childProfiles: (n: number) => string;
    settings: string;
    logout: string;
    childrenSection: string;
    progress: string;
    age: (n: number) => string;
    stars: string;
    startSession: string;
    addChildBtn: string;
    addChildSub: string;
    addChildTitle: string;
    chooseAvatar: string;
    nameLabel: string;
    ageLabel: string;
    learningDirection: string;
    cancel: string;
    adding: string;
    addChild: string;
    notLoggedIn: string;
    removeConfirm: string;
    leaderboardTitle: string;
    leaderboardStars: (n: number) => string;
    leaderboardStreak: (n: number) => string;
  };
  child: {
    connectionProblem: string;
    connectionError: string;
    tryAgain: string;
    chooseTopicTitle: string;
    chooseTopicPrompt: (name: string) => string;
    gettingReady: string;
    startWithTicha: string;
    hello: (name: string) => string;
    dayStreak: string;
    yourLevel: string;
    today: string;
    startToday: string;
    streakDays: (n: number) => string;
    level: (n: number) => string;
    pctDone: (n: number) => string;
    letsPlay: string;
    learnWithTicha: string;
    learnWithTichaSub: string;
    wordGames: string;
    wordGamesSub: string;
    stars: (n: number) => string;
    progress: string;
    cooldownTitle: string;
    cooldownDesc: (n: number) => string;
    backHome: string;
    swahili: string;
    english: string;
    starsToNext: (n: number) => string;
    maxLevel: string;
    levelUpTitle: (n: number) => string;
    levelUpDesc: string;
    levelUpBtn: string;
    badgesTitle: string;
    badgeLocked: string;
    familyRank1: string;
    familyRankN: (name: string, gap: number) => string;
    myRoom: string;
    myRoomSub: string;
    myRoomTitle: string;
    myRoomLockedBtn: string;
  };
  progress: {
    backDashboard: string;
    title: (name: string) => string;
    totalStars: string;
    dayStreak: string;
    sessions: string;
    practiceTime: string;
    wordsLearned: string;
    levelInfo: (xp: number, next: number | string) => string;
    wordsPracticed: string;
    recentSessions: string;
    noSessions: string;
    words: (n: number) => string;
    min: (n: number) => string;
    connectionProblem: string;
    connectionError: string;
    back: string;
    tryAgain: string;
    gameLabels: Record<string, string>;
  };
  session: {
    reconnecting: string;
    connecting: string;
    readyToLearn: string;
    sessionPaused: string;
    tichaIsTalking: string;
    yourTurnToSpeak: string;
    gettingReady: string;
    hintStart: string;
    hintPaused: string;
    hintListening: string;
    hintSpeak: string;
    hintWait: string;
    labelPaused: string;
    labelTalking: string;
    labelYourTurn: string;
    labelWaiting: string;
    resume: string;
    pause: string;
    end: string;
    reconnectTitle: string;
    reconnectSub: string;
    tryAgain: string;
  };
  settings: {
    back: string;
    title: string;
    voiceTitle: string;
    voiceDescs: string[];
    textSizeTitle: string;
    textSizes: { normal: string; large: string; xlarge: string };
    themeTitle: string;
    themes: { label: string; desc: string }[];
    accessibilityTitle: string;
    toggles: { label: string; desc: string }[];
    footer: string;
  };
  resetPassword: {
    title: string;
    subtitle: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    saving: string;
    saveBtn: string;
    successTitle: string;
    successDesc: string;
    errors: {
      noMatch: string;
      tooShort: string;
      generic: string;
    };
  };
}

export const T: Record<Lang, Translations> = {
  en: {
    offline: {
      banner: "You're offline · Connect to the internet to use all features",
      sessionTitle: "No Internet Right Now",
      sessionDesc: "Ticha needs internet to have a conversation. Connect to Wi-Fi or mobile data, then come back!",
      sessionBack: "← Go Back",
      cachedData: "Showing your saved data · Connect for the latest updates",
    },
    landing: {
      navLogin: "Log In",
      navGetStarted: "Get Started",
      heroTitle: "Empowering African Children to Speak English and African Languages",
      heroTitleHighlight: "Through Live Conversation",
      heroSubtitle: "Ticha is your child's personal voice tutor, built for African children. No reading, no typing — just talk.",
      heroLanguageNote: "Starting with",
      heroLanguageSub: "— spoken by 200 million people across East Africa",
      heroCta: "🚀 Start Learning Free",
      heroLogin: "Already have an account? Log in →",
      heroFine: "",
      languagesTitle: "Languages",
      available: "✓ Available now",
      comingSoon: "Coming soon",
      featuresTitle: "Built for the way children really learn",
      featuresSub: "Designed for the way African children learn",
      features: [
        { title: "Voice-Only Interaction", desc: "No reading or typing needed. The child simply talks — Ticha listens, responds, and teaches in real time." },
        { title: "Authentic African Context", desc: "Hooks rooted in East African culture — animals, family, community. Every lesson feels like home." },
        { title: "Gamified & Rewarding", desc: "XP, stars, streaks, and level titles keep children motivated and coming back every day." },
        { title: "Structured CEFR A1 Lessons", desc: "3-exchange lesson design backed by language-learning research. Children genuinely retain what they learn." },
        { title: "Parent Dashboard", desc: "Track every session, word learned, XP earned, and streak — all in one clean parent view." },
        { title: "Fully Accessible", desc: "High contrast, large touch targets, slow speech mode, and visual aids — no child excluded." },
      ],
      howTitle: "How Ticha works",
      howSub: "Three steps. One conversation.",
      howSteps: [
        { title: "Parent sets up a profile", desc: "Create your account, add your child's name and learning direction — English to Swahili or Swahili to English." },
        { title: "Child taps Start and just talks", desc: "Ticha greets them by name, introduces 5 words through vivid stories and real questions — entirely by voice." },
        { title: "Earn stars, build streaks", desc: "Every session awards XP and stars. Parents see the progress dashboard. Children see their level grow." },
      ],
      missionLabel: "The Mission Behind Ticha",
      missionNonprofit: "🌱 Nonprofit",
      missionRegistered: "📋 Registered",
      missionTitleLine1: "Ticha is a",
      missionHighlight: "Grow Wise Africa",
      missionTitleLine2: "Initiative",
      missionDesc1: "Grow Wise Africa is a registered nonprofit in Tanzania dedicated to empowering the next generation through education, technology, and leadership.",
      missionDesc2: "Every time your child learns with Ticha, you're supporting that mission — helping more African children access quality learning tools, regardless of where they come from.",
      missionQuote: "\u201cTechnology in service of Africa\u2019s children.\u201d",
      whoTitle: "Who is Ticha for? 🌍",
      whoSub: "Every child who deserves to grow up speaking their language.",
      whoCards: [
        { title: "African children", desc: "Learning English through play — no textbooks needed." },
        { title: "Diaspora kids", desc: "Reconnecting with Swahili while living abroad." },
        { title: "Swahili learners", desc: "Gateway to 200M+ speakers across East Africa." },
        { title: "All abilities", desc: "Visual mode, slow speech, high contrast — no child excluded." },
      ],
      ctaTitle: "Ready to start? Twende! 🌍",
      ctaSub: "",
      ctaButton: "🎓 Create Free Account",
      ctaLogin: "Parent login →",
      footerCopy: "© 2026 Grow Wise Africa · Built by Nuruni Tech",
      footerSub: "🌍 Built for African children · ♿ Accessible by design",
      footerPrivacy: "Privacy Policy",
      footerTerms: "Terms of Service",
    },
    login: {
      title: "Welcome back!",
      subtitle: "Log in to your Ticha account",
      google: "Continue with Google",
      googleRedirecting: "Redirecting...",
      orEmail: "or with email",
      emailLabel: "Email",
      passwordLabel: "Password",
      forgotPassword: "Forgot password?",
      showPassword: "Show password",
      hidePassword: "Hide password",
      loggingIn: "Logging in...",
      loginBtn: "Log In →",
      noAccount: "No account?",
      signUpFree: "Sign up free",
      resetTitle: "Reset Password",
      resetSubtitle: "We'll send you a reset link",
      emailAddressLabel: "Email address",
      sending: "Sending...",
      sendResetLink: "Send Reset Link",
      backToLogin: "← Back to Login",
      checkInbox: "Check your inbox",
      resetSentTo: (email) => `We sent a password reset link to ${email}.`,
      backToLoginBtn: "Back to Login",
      errors: {
        authFailed: "Authentication failed. Please try again.",
        wrongCredentials: "Incorrect email or password. Please try again.",
        confirmEmail: "Please confirm your email before logging in. Check your inbox.",
        rateLimit: "Too many attempts. Please wait a few minutes and try again.",
        connection: "Connection error. Check your internet and try again.",
        enterEmail: "Enter your email address above first.",
      },
    },
    signup: {
      title: "Join Ticha",
      subtitle: "Create a free parent account",
      google: "Continue with Google",
      googleRedirecting: "Redirecting...",
      orEmail: "or with email",
      nameLabel: "Your name",
      namePlaceholder: "e.g. Amina Juma",
      emailLabel: "Email",
      passwordLabel: "Password",
      passwordPlaceholder: "Min. 8 characters",
      passwordStrength: { weak: "Weak", fair: "Fair", good: "Good", strong: "Strong" },
      creating: "Creating account...",
      createBtn: "🚀 Create Account",
      alreadyAccount: "Already have an account?",
      loginLink: "Log in",
      privacyNote: "🔒 Your data is private · ♿ Accessible by design · 🌍 Built for Africa",
      confirmTitle: "Check your email",
      confirmSentTo: (email) => `We sent a confirmation link to ${email}.`,
      confirmInstructions: "Click the link in the email to activate your account, then log in here.",
      goToLogin: "Go to Login →",
      noEmail: "Didn't receive it? Check your spam folder.",
      errors: {
        enterName: "What should we call you? Please enter your name.",
        passwordShort: "Password needs to be at least 8 characters — almost there!",
        emailExists: "An account with this email already exists. Try logging in instead.",
        passwordWeak: "Try a stronger password — mix letters and numbers for best results.",
        invalidEmail: "That email doesn't look right. Double-check and try again.",
        rateLimit: "Too many attempts — take a short break and try again in a moment.",
        connection: "Can't connect right now. Check your internet and try again.",
      },
    },
    dashboard: {
      loading: "Loading...",
      connectionProblem: "Oops — we lost the connection",
      connectionError: "We couldn't load your dashboard. Check your internet and give it another try — your data is safe!",
      tryAgain: "Try Again",
      welcome: (name) => `Welcome, ${name}!`,
      noChildren: "Add your first child to begin the adventure! 🎉",
      childProfiles: (n) => `${n} child profile${n !== 1 ? "s" : ""} — tap to start a session`,
      settings: "⚙️ Settings",
      logout: "Log out",
      childrenSection: "👦 Children",
      progress: "📊 Progress",
      age: (n) => `Age ${n}`,
      stars: "Stars",
      startSession: "▶ Start Session",
      addChildBtn: "Add a child",
      addChildSub: "Create a new profile",
      addChildTitle: "Add a child 👦",
      chooseAvatar: "Choose an avatar",
      nameLabel: "Name *",
      ageLabel: "Age (optional)",
      learningDirection: "Learning direction",
      cancel: "Cancel",
      adding: "Adding...",
      addChild: "➕ Add Child",
      notLoggedIn: "Not logged in.",
      removeConfirm: "Remove this child profile?",
      leaderboardTitle: "🏅 Family Leaderboard",
      leaderboardStars: (n) => `${n} stars`,
      leaderboardStreak: (n) => `${n}-day streak`,
    },
    child: {
      connectionProblem: "Oops — we lost the connection",
      connectionError: "We couldn't load this profile. Check your internet and try again — nothing was lost!",
      tryAgain: "Try Again",
      chooseTopicTitle: "Choose a Topic! ⭐",
      chooseTopicPrompt: (name) => `What shall we learn today, ${name}? 🎯`,
      gettingReady: "⏳ Getting ready...",
      startWithTicha: "🚀 Start with Ticha!",
      hello: (name) => `Hello, ${name}! 👋🏾`,
      dayStreak: "Day Streak",
      yourLevel: "Your Level",
      today: "Today",
      startToday: "Start today!",
      streakDays: (n) => `${n} Days! 🔥`,
      level: (n) => `Level ${n} ⭐`,
      pctDone: (n) => `${n}% Done!`,
      letsPlay: "Let's Play & Learn!",
      learnWithTicha: "Learn with Ticha",
      learnWithTichaSub: "Talk and learn together!",
      wordGames: "Word Games",
      wordGamesSub: "Match pictures and words!",
      stars: (n) => `⭐ ${n} Stars`,
      progress: "📊 Progress",
      cooldownTitle: "Great effort today!",
      cooldownDesc: (n) => `You've played ${n} quizzes today — come back tomorrow for more Word Games! 🌟`,
      backHome: "← Back Home",
      swahili: "Swahili",
      english: "English",
      starsToNext: (n) => `${n} stars to next level!`,
      maxLevel: "Max Level! 🏆",
      levelUpTitle: (n) => `Level ${n} Unlocked! 🎉`,
      levelUpDesc: "You're on fire — keep going!",
      levelUpBtn: "Let's keep going! 🚀",
      badgesTitle: "My Badges",
      badgeLocked: "Locked",
      familyRank1: "You're #1 in your family! 🏆",
      familyRankN: (name, gap) => `${name} is ahead by ${gap} stars! Keep going!`,
      myRoom: "My Room",
      myRoomSub: "Decorate your classroom!",
      myRoomTitle: "My Classroom",
      myRoomLockedBtn: "Let's earn it! 🚀",
    },
    progress: {
      backDashboard: "← Dashboard",
      title: (name) => `${name}'s Progress`,
      totalStars: "Total Stars",
      dayStreak: "Day Streak",
      sessions: "Sessions",
      practiceTime: "Practice Time",
      wordsLearned: "Words Learned",
      levelInfo: (xp, next) => `⭐ ${xp} Stars · Next level at ${next} Stars`,
      wordsPracticed: "🔤 Words Practiced",
      recentSessions: "📅 Recent Sessions",
      noSessions: "No sessions yet — start one from the dashboard!",
      words: (n) => `${n} words`,
      min: (n) => `${n}min`,
      connectionProblem: "Oops — we lost the connection",
      connectionError: "We couldn't load the progress report. Check your internet and try again — all stars and streaks are safe!",
      back: "← Back",
      tryAgain: "Try Again",
      gameLabels: {
        animals: "🦁 Animals",
        numbers: "🔢 Numbers",
        colors:  "🎨 Colors",
        body:    "🫀 Body Parts",
        people:  "👨‍👩‍👧‍👦 People",
        chakula: "🍽️ Food",
        vitenzi: "🏃 Verbs",
        shule:   "📚 School",
        hisia:   "❤️ Feelings",
        mazingira: "🌿 Nature",
      },
    },
    session: {
      reconnecting: "Reconnecting...",
      connecting: "Connecting...",
      readyToLearn: "Ready to learn!",
      sessionPaused: "Session paused",
      tichaIsTalking: "Ticha is talking...",
      yourTurnToSpeak: "Your turn to speak!",
      gettingReady: "Getting ready...",
      hintStart: "👇🏾 Press the microphone to start your lesson",
      hintPaused: "⏸ Session paused — tap Resume",
      hintListening: "🔊 Listen carefully to Ticha...",
      hintSpeak: "🎤 Your turn — just speak!",
      hintWait: "⏳ Getting ready...",
      labelPaused: "PAUSED",
      labelTalking: "TICHA IS TALKING",
      labelYourTurn: "YOUR TURN — JUST SPEAK!",
      labelWaiting: "GETTING READY...",
      resume: "▶ Resume",
      pause: "⏸ Pause",
      end: "✕ End",
      reconnectTitle: "🔄 Reconnecting to Ticha...",
      reconnectSub: "Hold on — your progress is safe.",
      tryAgain: "Try Again",
    },
    settings: {
      back: "← Back",
      title: "⚙️ Settings",
      voiceTitle: "🗣️ Ticha's Voice",
      voiceDescs: [
        "Warm, friendly — Ticha's default voice",
        "Clear, energetic — great for active learners",
      ],
      textSizeTitle: "🔡 Text Size",
      textSizes: { normal: "Normal", large: "Large", xlarge: "X-Large" },
      themeTitle: "🎨 Display Theme",
      themes: [
        { label: "🌟 Default",        desc: "Warm yellows and greens" },
        { label: "⬛ High Contrast",   desc: "Black & white, maximum readability for low vision" },
        { label: "👁️ Colorblind Safe", desc: "Optimised for colour vision deficiency" },
      ],
      accessibilityTitle: "♿ Accessibility",
      toggles: [
        { label: "Slow Speech Mode",  desc: "Ticha speaks slower and more clearly — great for beginners and young learners" },
        { label: "Visual Mode",       desc: "For deaf / hard-of-hearing learners — large emoji animations and text replace audio responses" },
        { label: "High Contrast",     desc: "Maximum colour contrast for low vision or bright screen conditions" },
        { label: "Reduce Motion",     desc: "Disable animations — helpful for motion sensitivity or epilepsy" },
      ],
      footer: "Settings are saved automatically on this device.\n♿ Ticha is built to be accessible to every child.",
    },
    resetPassword: {
      title: "Set a new password",
      subtitle: "Choose a strong password for your account",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      saving: "Saving...",
      saveBtn: "Set New Password →",
      successTitle: "Password updated!",
      successDesc: "You're all set — taking you to your dashboard now.",
      errors: {
        noMatch: "Passwords don't match — please check and try again.",
        tooShort: "Password must be at least 8 characters.",
        generic: "Something went wrong. Please try again.",
      },
    },
  },

  sw: {
    offline: {
      banner: "Hakuna mtandao · Baadhi ya vipengele havitafanya kazi",
      sessionTitle: "Hakuna Muunganisho wa Mtandao",
      sessionDesc: "Ticha anahitaji mtandao kuzungumza. Unganika na Wi-Fi au data ya simu, kisha jaribu tena.",
      sessionBack: "← Rudi",
      cachedData: "Inaonyesha data iliyohifadhiwa · Unganika kwa masasisho ya hivi karibuni",
    },
    landing: {
      navLogin: "Ingia",
      navGetStarted: "Jiunge",
      heroTitle: "Huwezesha Watoto wa Kiafrika Kuongea Kiingereza na Lugha za Kiafrika",
      heroTitleHighlight: "Kupitia Mazungumzo ya Moja kwa Moja",
      heroSubtitle: "Ticha ni mwalimu binafsi wa mtoto anayefundisha kwa sauti, aliyebuniwa mahsusi kwa watoto wa Afrika. Hakuna kusoma, hakuna kuandika — ni kuzungumza tu.",
      heroLanguageNote: "Tukianza na",
      heroLanguageSub: "— zinazozungumzwa na zaidi ya watu milioni 200 Afrika Mashariki",
      heroCta: "🚀 Anza Kujifunza Bure",
      heroLogin: "Una akaunti tayari? Ingia →",
      heroFine: "",
      languagesTitle: "Lugha",
      available: "✓ Inapatikana sasa",
      comingSoon: "Inakuja hivi karibuni",
      featuresTitle: "Imejengwa kwa njia ambavyo watoto hujifunza kweli",
      featuresSub: "Imebuniwa kwa njia ya kujifunza ya watoto wa Afrika",
      features: [
        { title: "Mazungumzo ya Sauti Tu", desc: "Hakuna kusoma wala kuandika. Mtoto anazungumza tu — Ticha anasikiliza, anajibu, na anafundisha wakati halisi." },
        { title: "Muktadha wa Kweli wa Kiafrika", desc: "Masomo yenye mizizi katika utamaduni wa Afrika Mashariki — wanyama, familia, jamii. Kila somo linahisi kama nyumbani." },
        { title: "Kama Mchezo na Yenye Thawabu", desc: "XP, nyota, mfululizo, na vyeo huweka watoto wakiwa na motisha na kurudi kila siku." },
        { title: "Masomo ya Muundo wa CEFR A1", desc: "Muundo wa somo wenye mazungumzo 3, unaounga mkono na utafiti wa kujifunza lugha. Watoto wanakumbuka wanachojifunza kweli kweli." },
        { title: "Dashibodi ya Mzazi", desc: "Fuatilia kila darasa, neno lililojifunzwa, XP iliyopatikana, na mfululizo — yote katika muonekano safi wa mzazi." },
        { title: "Inafikika Kabisa", desc: "Tofauti nyingi za rangi, vitufe vikubwa, hali ya hotuba polepole, na visaidizi vya kuona — hakuna mtoto aliyetengwa." },
      ],
      howTitle: "Jinsi Ticha Inavyofanya Kazi",
      howSub: "Hatua tatu. Mazungumzo moja.",
      howSteps: [
        { title: "Mzazi huunda wasifu", desc: "Fungua akaunti yako, ongeza jina la mtoto wako na mwelekeo wa kujifunza — Kiingereza hadi Kiswahili au Kiswahili hadi Kiingereza." },
        { title: "Mtoto anabonyeza Anza na kuzungumza tu", desc: "Ticha anamsalimia kwa jina lake, anaanzisha maneno 5 kupitia hadithi za kuvutia na maswali ya kweli — kwa sauti peke yake." },
        { title: "Pata nyota, jenga mfululizo", desc: "Kila darasa linatoa XP na nyota. Wazazi wanaona dashibodi ya maendeleo. Watoto wanaona kiwango chao kikua." },
      ],
      missionLabel: "Dhamira ya Ticha",
      missionNonprofit: "🌱 Shirika Lisilo la Faida",
      missionRegistered: "📋 Iliyosajiliwa",
      missionTitleLine1: "Ticha ni mpango wa",
      missionHighlight: "Grow Wise Africa",
      missionTitleLine2: "",
      missionDesc1: "Grow Wise Africa ni taasisi isiyo ya kiserikali iliyosajiliwa Tanzania, inayolenga kuwawezesha kizazi kijacho kupitia elimu, teknolojia, na uongozi.",
      missionDesc2: "Kila mara mtoto wako anapojifunza na Ticha, unachangia kufanikisha dhamira hii — kusaidia watoto zaidi barani Afrika kupata fursa ya kujifunza kwa kutumia zana bora, bila kujali wanatoka wapi.",
      missionQuote: "\u201cTeknolojia katika huduma ya watoto wa Afrika.\u201d",
      whoTitle: "Ticha ni kwa ajili ya nani? 🌍",
      whoSub: "Kila mtoto anayestahili kukua akizungumza lugha yake.",
      whoCards: [
        { title: "Watoto wa Afrika", desc: "Wanajifunza Kiingereza kupitia michezo — bila vitabu vya darasani." },
        { title: "Watoto wa diaspora", desc: "Wanaunganika tena na Kiswahili wakiwa wanaishi nje ya nchi." },
        { title: "Wanaojifunza Kiswahili", desc: "Uwezo wa kuwasiliana na zaidi ya watu milioni 200 wanaozungumza Afrika Mashariki." },
        { title: "Watoto wa uwezo wote", desc: "Hali ya kuona (visual mode), sauti ya polepole, mwonekano wenye utofauti mkubwa — hakuna mtoto anayeachwa nyuma." },
      ],
      ctaTitle: "Uko tayari kuanza? Twende! 🌍",
      ctaSub: "",
      ctaButton: "🎓 Fungua Akaunti Bure",
      ctaLogin: "Ingia kama mzazi →",
      footerCopy: "© 2026 Grow Wise Africa · Imejengwa na Nuruni Tech",
      footerSub: "🌍 Imejengwa kwa watoto wa Afrika · ♿ Inafikika kwa muundo",
      footerPrivacy: "Sera ya Faragha",
      footerTerms: "Masharti ya Huduma",
    },
    login: {
      title: "Karibu tena!",
      subtitle: "Ingia kwenye akaunti yako ya Ticha",
      google: "Endelea na Google",
      googleRedirecting: "Inaelekeza...",
      orEmail: "au kwa barua pepe",
      emailLabel: "Barua pepe",
      passwordLabel: "Nywila",
      forgotPassword: "Umesahau nywila?",
      showPassword: "Onyesha nywila",
      hidePassword: "Ficha nywila",
      loggingIn: "Inaingia...",
      loginBtn: "Ingia →",
      noAccount: "Huna akaunti?",
      signUpFree: "Jiandikishe bure",
      resetTitle: "Badilisha Nywila",
      resetSubtitle: "Tutakutumia kiungo cha kubadilisha",
      emailAddressLabel: "Anwani ya barua pepe",
      sending: "Inatuma...",
      sendResetLink: "Tuma Kiungo cha Kubadilisha",
      backToLogin: "← Rudi kwenye Kuingia",
      checkInbox: "Angalia sanduku lako",
      resetSentTo: (email) => `Tulituma kiungo cha kubadilisha nywila kwa ${email}.`,
      backToLoginBtn: "Rudi kwenye Kuingia",
      errors: {
        authFailed: "Uthibitisho umeshindwa. Jaribu tena.",
        wrongCredentials: "Barua pepe au nywila si sahihi. Jaribu tena.",
        confirmEmail: "Tafadhali thibitisha barua pepe yako kabla ya kuingia. Angalia sanduku lako.",
        rateLimit: "Majaribio mengi sana. Subiri dakika chache na ujaribu tena.",
        connection: "Hitilafu ya muunganisho. Angalia mtandao wako na ujaribu tena.",
        enterEmail: "Kwanza weka anwani yako ya barua pepe hapo juu.",
      },
    },
    signup: {
      title: "Jiunge na Ticha",
      subtitle: "Fungua akaunti ya mzazi bila malipo",
      google: "Endelea na Google",
      googleRedirecting: "Inaelekeza...",
      orEmail: "au kwa barua pepe",
      nameLabel: "Jina lako",
      namePlaceholder: "mfano: Amina Juma",
      emailLabel: "Barua pepe",
      passwordLabel: "Nywila",
      passwordPlaceholder: "Angalau herufi 8",
      passwordStrength: { weak: "Dhaifu", fair: "Wastani", good: "Nzuri", strong: "Imara" },
      creating: "Inaunda akaunti...",
      createBtn: "🚀 Unda Akaunti",
      alreadyAccount: "Una akaunti tayari?",
      loginLink: "Ingia",
      privacyNote: "🔒 Data yako ni ya siri · ♿ Inafikika kwa muundo · 🌍 Imejengwa kwa Afrika",
      confirmTitle: "Angalia barua pepe yako",
      confirmSentTo: (email) => `Tulituma kiungo cha uthibitisho kwa ${email}.`,
      confirmInstructions: "Bonyeza kiungo kwenye barua pepe ili kuamsha akaunti yako, kisha ingia hapa.",
      goToLogin: "Nenda kwenye Kuingia →",
      noEmail: "Hukupokea? Angalia folda ya barua taka.",
      errors: {
        enterName: "Tafadhali weka jina lako.",
        passwordShort: "Nywila lazima iwe na angalau herufi 8.",
        emailExists: "Akaunti yenye barua pepe hii tayari ipo. Ingia badala yake.",
        passwordWeak: "Nywila ni dhaifu sana. Tumia angalau herufi 8 na nambari.",
        invalidEmail: "Tafadhali weka anwani sahihi ya barua pepe.",
        rateLimit: "Majaribio mengi sana. Subiri kidogo na ujaribu tena.",
        connection: "Hitilafu ya muunganisho. Angalia mtandao wako na ujaribu tena.",
      },
    },
    dashboard: {
      loading: "Inapakia...",
      connectionProblem: "Tatizo la Muunganisho",
      connectionError: "Haikuweza kupakia dashibodi yako. Tafadhali angalia mtandao wako na ujaribu tena.",
      tryAgain: "Jaribu Tena",
      welcome: (name) => `Karibu, ${name}!`,
      noChildren: "Ongeza mtoto wako wa kwanza kuanza.",
      childProfiles: (n) => `wasifu wa watoto ${n} — gonga kuanza darasa`,
      settings: "⚙️ Mipangilio",
      logout: "Toka",
      childrenSection: "👦 Watoto",
      progress: "📊 Maendeleo",
      age: (n) => `Umri ${n}`,
      stars: "Nyota",
      startSession: "▶ Anza Darasa",
      addChildBtn: "Ongeza mtoto",
      addChildSub: "Unda wasifu mpya",
      addChildTitle: "Ongeza mtoto 👦",
      chooseAvatar: "Chagua picha",
      nameLabel: "Jina *",
      ageLabel: "Umri (si lazima)",
      learningDirection: "Mwelekeo wa kujifunza",
      cancel: "Ghairi",
      adding: "Inaongeza...",
      addChild: "➕ Ongeza Mtoto",
      notLoggedIn: "Haujaingia.",
      removeConfirm: "Ondoa wasifu huu wa mtoto?",
      leaderboardTitle: "🏅 Orodha ya Familia",
      leaderboardStars: (n) => `nyota ${n}`,
      leaderboardStreak: (n) => `siku ${n} mfululizo`,
    },
    child: {
      connectionProblem: "Tatizo la Muunganisho",
      connectionError: "Haikuweza kupakia wasifu. Tafadhali angalia mtandao wako na ujaribu tena.",
      tryAgain: "Jaribu Tena",
      chooseTopicTitle: "Chagua Mada! ⭐",
      chooseTopicPrompt: (name) => `Tutajifunza nini leo, ${name}? 🎯`,
      gettingReady: "⏳ Inajiandaa...",
      startWithTicha: "🚀 Anza na Ticha!",
      hello: (name) => `Habari, ${name}! 👋🏾`,
      dayStreak: "Mfululizo wa Siku",
      yourLevel: "Kiwango Chako",
      today: "Leo",
      startToday: "Anza leo!",
      streakDays: (n) => `Siku ${n}! 🔥`,
      level: (n) => `Kiwango ${n} ⭐`,
      pctDone: (n) => `${n}% Imekamilika!`,
      letsPlay: "Twende Kucheza na Kujifunza!",
      learnWithTicha: "Jifunze na Ticha",
      learnWithTichaSub: "Zungumza na ujifunze pamoja!",
      wordGames: "Michezo ya Maneno",
      wordGamesSub: "Linganisha picha na maneno!",
      stars: (n) => `⭐ Nyota ${n}`,
      progress: "📊 Maendeleo",
      cooldownTitle: "Jitihada nzuri leo!",
      cooldownDesc: (n) => `Umecheza maswali ${n} leo — rudi kesho kwa michezo zaidi ya maneno! 🌟`,
      backHome: "← Rudi Nyumbani",
      swahili: "Kiswahili",
      english: "Kiingereza",
      starsToNext: (n) => `Nyota ${n} zaidi kwa kiwango kinachofuata!`,
      maxLevel: "Kiwango cha Juu! 🏆",
      levelUpTitle: (n) => `Kiwango ${n} Kimefunguliwa! 🎉`,
      levelUpDesc: "Unawaka moto — endelea hivyo!",
      levelUpBtn: "Twende mbele! 🚀",
      badgesTitle: "Beji Zangu",
      badgeLocked: "Imefungwa",
      familyRank1: "Wewe ni #1 kwa familia! 🏆",
      familyRankN: (name, gap) => `${name} yuko mbele kwa nyota ${gap}! Endelea!`,
      myRoom: "Chumba Changu",
      myRoomSub: "Pamba darasa lako!",
      myRoomTitle: "Darasa Langu",
      myRoomLockedBtn: "Twende kupata! 🚀",
    },
    progress: {
      backDashboard: "← Dashibodi",
      title: (name) => `Maendeleo ya ${name}`,
      totalStars: "Nyota Zote",
      dayStreak: "Mfululizo wa Siku",
      sessions: "Madarasa",
      practiceTime: "Muda wa Mazoezi",
      wordsLearned: "Maneno Yaliyojifunzwa",
      levelInfo: (xp, next) => `⭐ Nyota ${xp} · Kiwango kinachofuata kwa Nyota ${next}`,
      wordsPracticed: "🔤 Maneno Yaliyofanyiwa Mazoezi",
      recentSessions: "📅 Madarasa ya Hivi Karibuni",
      noSessions: "Hakuna darasa bado — anza moja kutoka dashibodi!",
      words: (n) => `maneno ${n}`,
      min: (n) => `dk ${n}`,
      connectionProblem: "Tatizo la Muunganisho",
      connectionError: "Haikuweza kupakia maendeleo. Tafadhali angalia mtandao wako na ujaribu tena.",
      back: "← Rudi",
      tryAgain: "Jaribu Tena",
      gameLabels: {
        animals: "🦁 Wanyama",
        numbers: "🔢 Nambari",
        colors:  "🎨 Rangi",
        body:    "🫀 Mwili",
        people:  "👨‍👩‍👧‍👦 Watu",
        chakula: "🍽️ Chakula",
        vitenzi: "🏃 Vitenzi",
        shule:   "📚 Shule",
        hisia:   "❤️ Hisia",
        mazingira: "🌿 Mazingira",
      },
    },
    session: {
      reconnecting: "Kuunganisha tena...",
      connecting: "Inaungana...",
      readyToLearn: "Tayari kujifunza!",
      sessionPaused: "Darasa limesimamishwa",
      tichaIsTalking: "Ticha anazungumza...",
      yourTurnToSpeak: "Zamu yako kuzungumza!",
      gettingReady: "Inajiandaa...",
      hintStart: "👇🏾 Bonyeza maikrofoni kuanza darasa lako",
      hintPaused: "⏸ Darasa limesimamishwa — gonga Endelea",
      hintListening: "🔊 Sikiliza kwa makini Ticha...",
      hintSpeak: "🎤 Zamu yako — zungumza tu!",
      hintWait: "⏳ Inajiandaa...",
      labelPaused: "IMESIMAMISHWA",
      labelTalking: "TICHA ANAZUNGUMZA",
      labelYourTurn: "ZAMU YAKO — ZUNGUMZA TU!",
      labelWaiting: "INAJIANDAA...",
      resume: "▶ Endelea",
      pause: "⏸ Simamisha",
      end: "✕ Maliza",
      reconnectTitle: "🔄 Kuunganisha tena na Ticha...",
      reconnectSub: "Subiri kidogo — maendeleo yako yatabaki.",
      tryAgain: "Jaribu Tena",
    },
    settings: {
      back: "← Rudi",
      title: "⚙️ Mipangilio",
      voiceTitle: "🗣️ Sauti ya Ticha",
      voiceDescs: [
        "Joto, ya kirafiki — sauti ya chaguo ya Ticha",
        "Wazi, yenye nguvu — nzuri kwa wanafunzi wenye bidii",
      ],
      textSizeTitle: "🔡 Ukubwa wa Maandishi",
      textSizes: { normal: "Kawaida", large: "Kubwa", xlarge: "Kubwa Zaidi" },
      themeTitle: "🎨 Mandhari ya Onyesho",
      themes: [
        { label: "🌟 Chaguo-Msingi",          desc: "Njano na kijani zenye joto" },
        { label: "⬛ Tofauti Nyingi",           desc: "Nyeusi na nyeupe, uonekano bora kwa uoni hafifu" },
        { label: "👁️ Salama kwa Upofu wa Rangi", desc: "Imeboreshwa kwa upungufu wa kuona rangi" },
      ],
      accessibilityTitle: "♿ Ufikiwaji",
      toggles: [
        { label: "Hali ya Hotuba Polepole", desc: "Ticha anazungumza polepole na wazi zaidi — nzuri kwa wanafunzi wapya na wadogo" },
        { label: "Hali ya Kuona",           desc: "Kwa wanaopungukiwa kusikia — michoro mikubwa ya emoji na maandishi hubadilisha majibu ya sauti" },
        { label: "Tofauti Nyingi za Rangi", desc: "Tofauti ya juu ya rangi kwa uoni hafifu au hali za skrini angavu" },
        { label: "Punguza Mwendo",          desc: "Zima miondoko — husaidia kwa usikivu wa mwendo au kifafa" },
      ],
      footer: "Mipangilio imehifadhiwa moja kwa moja kwenye kifaa hiki.\n♿ Ticha imejengwa kufikika na kila mtoto.",
    },
    resetPassword: {
      title: "Weka nywila mpya",
      subtitle: "Chagua nywila imara kwa akaunti yako",
      newPasswordLabel: "Nywila mpya",
      confirmPasswordLabel: "Thibitisha nywila mpya",
      saving: "Inahifadhi...",
      saveBtn: "Weka Nywila Mpya →",
      successTitle: "Nywila imebadilishwa!",
      successDesc: "Umefanikiwa — tunakupeleka kwenye dashibodi yako.",
      errors: {
        noMatch: "Nywila hazifanani — tafadhali angalia na ujaribu tena.",
        tooShort: "Nywila lazima iwe na angalau herufi 8.",
        generic: "Kuna tatizo. Tafadhali jaribu tena.",
      },
    },
  },
};
