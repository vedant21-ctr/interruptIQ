import { EventRepository } from './events.repository';
import { CreateEventDto, EventQueryDto, EventResponseDto } from './events.dto';
import { NotFoundError } from '../../errors/app-error';

export class EventService {
  private repository: EventRepository;

  constructor(repository: EventRepository) {
    this.repository = repository;
  }

  private mapToResponseDto(event: any): EventResponseDto {
    return {
      id: event.id,
      userId: event.userId,
      source: event.source,
      sender: event.sender,
      title: event.title,
      body: event.body,
      category: event.category,
      priority: event.priority,
      status: event.status,
      payload: (event.payload as Record<string, any>) || null,
      metadata: (event.metadata as Record<string, any>) || null,
      timestamp: event.timestamp.toISOString(),
      createdAt: event.createdAt.toISOString(),
    };
  }

  async createEvent(userId: string, data: CreateEventDto): Promise<EventResponseDto> {
    const created = await this.repository.create(userId, data);
    return this.mapToResponseDto(created);
  }

  async listEvents(
    userId: string,
    query: EventQueryDto
  ): Promise<{ items: EventResponseDto[]; total: number; page: number; limit: number }> {
    const { items, total } = await this.repository.findManyByUserId(userId, query);
    
    return {
      items: items.map(item => this.mapToResponseDto(item)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getEventById(id: string, userId: string): Promise<EventResponseDto> {
    const event = await this.repository.findByIdAndUserId(id, userId);
    if (!event) {
      throw new NotFoundError(`Event with ID ${id} not found`);
    }
    return this.mapToResponseDto(event);
  }

  async deleteEvent(id: string, userId: string): Promise<void> {
    const result = await this.repository.deleteByIdAndUserId(id, userId);
    if (result.count === 0) {
      throw new NotFoundError(`Event with ID ${id} not found`);
    }
  }
}
