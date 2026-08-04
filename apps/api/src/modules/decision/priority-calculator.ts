import { Event } from '@prisma/client';

export class PriorityCalculator {
  static calculate(event: Event): 'low' | 'medium' | 'high' | 'critical' {
    const rawPriority = (event.priority || 'medium').toLowerCase();
    
    // Check if category is urgent
    if (event.category === 'urgent') {
      return 'critical';
    }

    // Check message body or title for urgent keywords
    const searchString = `${event.title} ${event.body}`.toUpperCase();
    const urgentKeywords = ['URGENT', 'ASAP', 'CRITICAL', 'BLOCKER', 'BREAKING'];
    
    if (urgentKeywords.some(keyword => searchString.includes(keyword))) {
      return 'critical';
    }

    // Map high -> high, urgent -> critical
    if (rawPriority === 'urgent' || rawPriority === 'critical') {
      return 'critical';
    }
    if (rawPriority === 'high') {
      return 'high';
    }
    if (rawPriority === 'low') {
      return 'low';
    }

    return 'medium';
  }
}
