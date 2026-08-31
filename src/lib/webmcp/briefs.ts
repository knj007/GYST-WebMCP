export const dailyAgentBrief = {
  opening: "The user is ready for today’s check-in. Start warmly, then help them name what moved and what got in the way.",
  suggested_questions: [
    "What moved today?",
    "What got in the way, if anything?",
    "What is the one commitment you want to carry into tomorrow?",
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
