import { Rule, Event, ContextSnapshot } from '@prisma/client';

export interface RuleCondition {
  field: string; // 'focusLevel' | 'priority' | 'workingMode' | 'category' | 'source' | 'sender' etc.
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any;
}

export interface RuleSchema {
  operator: 'AND' | 'OR';
  conditions: RuleCondition[];
}

export class RuleEngine {
  static evaluate(
    rules: Rule[],
    event: Event & { calculatedPriority?: string },
    context: ContextSnapshot | null
  ): { matchedRule: Rule; decision: string } | null {
    for (const rule of rules) {
      try {
        const schema = JSON.parse(rule.conditionJson) as RuleSchema;
        const matches = this.evaluateSchema(schema, event, context);
        if (matches) {
          // Normalize matched rule action to standard decision types
          const normalizedDecision = this.normalizeAction(rule.action);
          return { matchedRule: rule, decision: normalizedDecision };
        }
      } catch (err) {
        // Skip invalid/unparseable rules
        continue;
      }
    }
    return null;
  }

  private static evaluateSchema(
    schema: RuleSchema,
    event: Event & { calculatedPriority?: string },
    context: ContextSnapshot | null
  ): boolean {
    if (!schema.conditions || schema.conditions.length === 0) {
      return false;
    }

    const results = schema.conditions.map(cond => this.evaluateCondition(cond, event, context));

    if (schema.operator === 'OR') {
      return results.some(r => r === true);
    }

    // Default to AND
    return results.every(r => r === true);
  }

  private static evaluateCondition(
    condition: RuleCondition,
    event: Event & { calculatedPriority?: string },
    context: ContextSnapshot | null
  ): boolean {
    const { field, operator, value } = condition;
    let actualValue: any = null;

    // Resolve field value from context or event
    if (field === 'priority' || field === 'Priority') {
      actualValue = event.calculatedPriority || event.priority;
    } else if (field === 'category' || field === 'Category') {
      actualValue = event.category;
    } else if (context && (field === 'workingMode' || field === 'WorkingMode')) {
      actualValue = context.workingMode;
    } else if (context && (field === 'focusLevel' || field === 'FocusLevel')) {
      actualValue = context.focusLevel;
    } else if (context && field in context) {
      actualValue = (context as any)[field];
    } else if (field in event) {
      actualValue = (event as any)[field];
    } else {
      return false; // Field not found
    }

    if (actualValue === null || actualValue === undefined) {
      return false;
    }

    // Standardize comparison values
    const valString = String(actualValue).toLowerCase();
    const condString = String(value).toLowerCase();

    switch (operator) {
      case 'eq':
        return typeof actualValue === 'number' 
          ? actualValue === Number(value)
          : valString === condString;
      case 'neq':
        return typeof actualValue === 'number'
          ? actualValue !== Number(value)
          : valString !== condString;
      case 'gt':
        return Number(actualValue) > Number(value);
      case 'lt':
        return Number(actualValue) < Number(value);
      case 'gte':
        return Number(actualValue) >= Number(value);
      case 'lte':
        return Number(actualValue) <= Number(value);
      case 'contains':
        return valString.includes(condString);
      default:
        return false;
    }
  }

  private static normalizeAction(action: string): string {
    const act = action.toUpperCase();
    if (act === 'BYPASS') return 'IMMEDIATE';
    if (act === 'DELAY') return 'BATCH';
    if (act === 'IGNORE') return 'SILENT';
    return act; // E.g., IMMEDIATE, BATCH, SILENT, SUMMARIZE directly
  }
}
