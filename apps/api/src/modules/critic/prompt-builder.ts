export class PromptBuilder {
  static buildCriticPrompt(params: {
    event: any;
    decision: any;
    context: any;
    feedbackHistory: any[];
    similarEpisodes: any[];
  }): string {
    const { event, decision, context, feedbackHistory, similarEpisodes } = params;

    const eventStr = event
      ? `Source: ${event.source}\nSender: ${event.sender}\nTitle: ${event.title}\nBody: ${event.body}\nCategory: ${event.category}\nPriority: ${event.priority}`
      : 'None';

    const decisionStr = decision
      ? `Decision Action: ${decision.decision}\nReason: ${decision.reason}\nConfidence: ${decision.confidence}`
      : 'None';

    const contextStr = context
      ? `Activity: ${context.activity}\nWorking Mode: ${context.workingMode}\nFocus Level: ${context.focusLevel}/100\nNetwork: ${context.network}`
      : 'None';

    const feedbackStr =
      feedbackHistory.length > 0
        ? feedbackHistory
            .map(
              (f, i) => `[Feedback ${i + 1}] Action: ${f.userAction} | Comment: ${f.comment || ''}`
            )
            .join('\n')
        : 'No feedback provided yet.';

    const similarEpisodesStr =
      similarEpisodes.length > 0
        ? similarEpisodes
            .map(
              (s, i) =>
                `[Episode ${i + 1}] Decision: ${s.episode.decisionType} | Outcome: ${s.historicalOutcome} | Score: ${s.relevanceScore}\nExplanation: ${s.episode.explanation}`
            )
            .join('\n\n')
        : 'No similar historical episodes found.';

    return `
You are the AI Critic for InterruptIQ. Your job is to review a recent interruption delivery decision and evaluate if it was appropriate given the user context, user feedback, and historical cases.

### CURRENT EVENT
${eventStr}

### DECISION EVALUATED
${decisionStr}

### USER CONTEXT
${contextStr}

### USER FEEDBACK
${feedbackStr}

### SIMILAR HISTORICAL EPISODES
${similarEpisodesStr}

Please evaluate this interaction. Determine:
1. Was the decision appropriate? (verdict: APPROPRIATE, INAPPROPRIATE, or NEUTRAL)
2. Why? (explanation narrative)
3. Which strengths and weaknesses are identified?
4. What rules should be adjusted or created?

Output your response in valid JSON matching this schema:
{
  "verdict": "APPROPRIATE" | "INAPPROPRIATE" | "NEUTRAL",
  "confidence": number (float between 0.0 and 1.0),
  "explanation": "string description",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestedRuleChanges": [
    {
      "ruleName": "string",
      "action": "ADJUST" | "CREATE" | "DELETE" | "KEEP",
      "reason": "string"
    }
  ]
}
`;
  }
}
