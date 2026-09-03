export const dailyAgentBrief = {
  opening: "The user is ready for today’s check-in. Start warmly, then help them name what moved and what got in the way.",
  suggested_questions: [
    "What moved today?",
    "What got in the way, if anything?",
    "What is the one commitment you want to carry into tomorrow?",
  ],
} as const;

export const onboardingAgentBrief = {
  opening: "The owner is founding their GYST ledger. Read the current draft first, then interview them: areas of life or work, the goals inside each, why each goal matters, when it is due, how much it matters, and the first concrete commitments. Propose only what they said. You cannot commit; the owner reviews and commits by hand.",
  suggested_questions: [
    "Which areas of your life or work do you want this ledger to hold?",
    "Inside each area, what is the goal, why does it matter, and by when?",
    "What is the first concrete thing you will do toward each goal?",
  ],
} as const;

export const weeklyAgentBrief = {
  opening: "The user is ready for their weekly check-in. Read the bounded context first, then help them turn it into a clear decision.",
  suggested_questions: [
    "What is missing from the picture this week?",
    "What did the week actually show you?",
    "What decision and dated priorities follow from that?",
  ],
} as const;
