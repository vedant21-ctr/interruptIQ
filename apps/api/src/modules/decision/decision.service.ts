import { DecisionRepository } from './decision.repository';
import { PriorityCalculator } from './priority-calculator';
import { RuleEngine } from './rule-engine';
import { ExplanationGenerator } from './explanation-generator';
import { DecisionResponseDto } from './decision.dto';
import { NotFoundError } from '../../errors/app-error';
import { cacheService } from '../../services/cache.service';

export class DecisionService {
  private repository: DecisionRepository;

  constructor(repository: DecisionRepository) {
    this.repository = repository;
  }

  private mapToResponseDto(decision: any): DecisionResponseDto {
    return {
      id: decision.id,
      eventId: decision.eventId,
      contextSnapshotId: decision.contextSnapshotId,
      decision: decision.decision,
      reason: decision.reason,
      confidence: decision.confidence,
      signalsUsed: decision.signalsUsed,
      explanation: decision.explanation
        ? {
            narrative: decision.explanation.narrative,
            rulesAttribution: decision.explanation.rulesAttribution,
            semanticsAttribution: decision.explanation.semanticsAttribution,
            mlAttribution: decision.explanation.mlAttribution,
            historyAttribution: decision.explanation.historyAttribution,
          }
        : null,
      createdAt: decision.createdAt.toISOString(),
    };
  }

  async evaluateDecision(userId: string, eventId: string): Promise<DecisionResponseDto> {
    const data = await this.repository.findEventAndLatestContext(eventId, userId);
    if (!data) {
      throw new NotFoundError(`Event with ID ${eventId} not found`);
    }

    const { event, latestContext } = data;

    // Calculate priority
    const calculatedPriority = PriorityCalculator.calculate(event);
    const eventWithPriority = { ...event, calculatedPriority };

    // Load active rules
    const rules = await this.repository.findActiveRules(userId);

    // Evaluate rules
    const match = RuleEngine.evaluate(rules, eventWithPriority, latestContext);

    let decision = 'IMMEDIATE';
    let reason = 'No active rules matched, delivering immediately by default.';
    let confidence = 1.0;
    const signalsUsed: string[] = [];

    if (match) {
      decision = match.decision;
      reason = `Matched rule "${match.matchedRule.name}".`;
      confidence = 1.0; // Rule-based decisions are deterministic (100% confidence)
      signalsUsed.push(match.matchedRule.name);
    } else {
      if (calculatedPriority === 'critical') {
        decision = 'IMMEDIATE';
        reason = 'Delivered immediately because event priority is critical.';
      }
    }

    // Generate explanation
    const explanationNarrative = ExplanationGenerator.generate(
      decision,
      eventWithPriority,
      latestContext,
      match?.matchedRule
    );

    // Save decision
    const saved = await this.repository.createDecision({
      eventId,
      contextSnapshotId: latestContext?.id || null,
      decision,
      reason,
      confidence,
      signalsUsed,
      explanationNarrative,
    });

    // Invalidate cached decision history for the user
    await cacheService.invalidateByPrefix(`decision:history:${userId}`);

    return this.mapToResponseDto(saved);
  }

  async getDecisionById(id: string, userId: string): Promise<DecisionResponseDto> {
    const cacheKey = `decision:${userId}:${id}`;
    const cached = await cacheService.get<DecisionResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const decision = await this.repository.findByIdAndUserId(id, userId);
    if (!decision) {
      throw new NotFoundError(`Decision with ID ${id} not found`);
    }
    
    const response = this.mapToResponseDto(decision);
    await cacheService.set(cacheKey, response, 600); // Cache for 10 minutes
    return response;
  }

  async getDecisionHistory(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: DecisionResponseDto[]; total: number; page: number; limit: number }> {
    const cacheKey = `decision:history:${userId}:${page}:${limit}`;
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;
    const { items, total } = await this.repository.findManyByUserId(userId, skip, limit);

    const response = {
      items: items.map(item => this.mapToResponseDto(item)),
      total,
      page,
      limit,
    };

    await cacheService.set(cacheKey, response, 300); // Cache for 5 minutes
    return response;
  }
}
