import { Rule, Event, ContextSnapshot } from '@prisma/client';

export class ExplanationGenerator {
  static generate(
    decision: string,
    event: Event & { calculatedPriority?: string },
    context: ContextSnapshot | null,
    matchedRule?: Rule
  ): string {
    const priority = event.calculatedPriority || event.priority || 'medium';
    
    if (matchedRule) {
      const ruleName = matchedRule.name;
      
      if (decision === 'BATCH') {
        const focus = context?.focusLevel !== null ? `Focus Level is ${context?.focusLevel}` : 'Focus Level is high';
        return `Notification batched according to rule "${ruleName}" because ${focus} and the event priority was low.`;
      }
      
      if (decision === 'IMMEDIATE') {
        return `Notification delivered immediately according to rule "${ruleName}" because the event priority is critical.`;
      }
      
      if (decision === 'SILENT') {
        const mode = context?.workingMode ? `Working Mode is ${context?.workingMode}` : 'user is in a meeting';
        return `Notification silenced according to rule "${ruleName}" because ${mode} and the category is social.`;
      }

      return `Notification processed as ${decision} according to rule "${ruleName}".`;
    }

    // Default fallbacks (no matched rule)
    if (priority === 'critical' || priority === 'urgent') {
      return `Notification delivered immediately because the event priority is critical.`;
    }

    return `Notification delivered immediately because no active rules matched and the event priority is ${priority}.`;
  }
}
