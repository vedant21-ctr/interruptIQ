import { CriticSuggestedRuleChangeDto } from './critic.dto';

export interface CriticResult {
  verdict: 'APPROPRIATE' | 'INAPPROPRIATE' | 'NEUTRAL';
  confidence: number;
  explanation: string;
  strengths: string[];
  weaknesses: string[];
  suggestedRuleChanges: CriticSuggestedRuleChangeDto[];
  rawResponse: string;
}

export interface CriticProvider {
  evaluate(prompt: string, episodeDetails?: any): Promise<CriticResult>;
}

export class MockProvider implements CriticProvider {
  async evaluate(prompt: string, episodeDetails?: any): Promise<CriticResult> {
    // Determine verdict dynamically based on whether the outcome has overrides
    const isOverridden =
      episodeDetails?.outcome === 'OVERRIDDEN' ||
      (episodeDetails?.feedbackSummary && episodeDetails.feedbackSummary.includes('OVERRIDDEN'));

    const verdict: 'APPROPRIATE' | 'INAPPROPRIATE' | 'NEUTRAL' = isOverridden
      ? 'INAPPROPRIATE'
      : 'APPROPRIATE';
    const confidence = isOverridden ? 0.85 : 0.95;
    const explanation = isOverridden
      ? 'The user overrode the decision. The AI engine should adjust focus levels threshold or handle sender priority category mappings.'
      : 'The delivery decision matches user expectations and active context guidelines.';

    const strengths = isOverridden
      ? ['Captured the override feedback correctly']
      : [
          'Accurately batch-grouped social message low urgency event',
          'Respected focus mode criteria',
        ];

    const weaknesses = isOverridden
      ? [
          'Failed to recognize user priority override context',
          'Too aggressive batching of family communications',
        ]
      : ['None identified'];

    const suggestedRuleChanges: CriticSuggestedRuleChangeDto[] = isOverridden
      ? [
          {
            ruleName: 'Override Rule Modification',
            action: 'ADJUST',
            reason: 'User override signals that Slack channel batching threshold needs revision',
          },
        ]
      : [];

    const jsonRes = {
      verdict,
      confidence,
      explanation,
      strengths,
      weaknesses,
      suggestedRuleChanges,
    };

    return {
      ...jsonRes,
      rawResponse: JSON.stringify(jsonRes),
    };
  }
}

export class OpenAIProvider implements CriticProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || 'mock-key';
  }

  async evaluate(prompt: string, episodeDetails?: any): Promise<CriticResult> {
    // Stub OpenAI API call (if api key is mock-key, use mock evaluator fallback)
    if (this.apiKey === 'mock-key') {
      return new MockProvider().evaluate(prompt, episodeDetails);
    }

    try {
      // In production, we would perform fetch request to OpenAI API
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are an AI Critic. Output valid JSON matching the format.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      const data = (await res.json()) as any;
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);

      return {
        verdict: parsed.verdict || 'NEUTRAL',
        confidence: parsed.confidence || 0.8,
        explanation: parsed.explanation || '',
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestedRuleChanges: parsed.suggestedRuleChanges || [],
        rawResponse: content,
      };
    } catch {
      // Fallback on timeout or compile errors
      return new MockProvider().evaluate(prompt, episodeDetails);
    }
  }
}

export class OllamaProvider implements CriticProvider {
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  }

  async evaluate(prompt: string, episodeDetails?: any): Promise<CriticResult> {
    try {
      const res = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt,
          format: 'json',
          stream: false,
        }),
      });

      const data = (await res.json()) as any;
      const parsed = JSON.parse(data.response);

      return {
        verdict: parsed.verdict || 'NEUTRAL',
        confidence: parsed.confidence || 0.75,
        explanation: parsed.explanation || '',
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestedRuleChanges: parsed.suggestedRuleChanges || [],
        rawResponse: data.response,
      };
    } catch {
      // Fallback on Ollama offline / local mock
      return new MockProvider().evaluate(prompt, episodeDetails);
    }
  }
}
