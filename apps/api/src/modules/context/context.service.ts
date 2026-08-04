import { ContextRepository } from './context.repository';
import { CreateContextSnapshotDto, ContextSnapshotResponseDto, PatchContextSnapshotDto, CreateContextSnapshotSchema } from './context.dto';
import { NotFoundError } from '../../errors/app-error';

export class ContextService {
  private repository: ContextRepository;

  constructor(repository: ContextRepository) {
    this.repository = repository;
  }

  private mapToResponseDto(snapshot: any): ContextSnapshotResponseDto {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      battery: snapshot.battery,
      charging: snapshot.charging,
      activity: snapshot.activity,
      timeOfDay: snapshot.timeOfDay,
      visibility: snapshot.visibility,
      network: snapshot.network,
      location: snapshot.location,
      motion: snapshot.motion,
      heartRate: snapshot.heartRate,
      
      currentTask: snapshot.currentTask,
      focusLevel: snapshot.focusLevel,
      calendarStatus: snapshot.calendarStatus,
      workingMode: snapshot.workingMode,
      deviceStatus: snapshot.deviceStatus,
      manualNotes: snapshot.manualNotes,
      metadata: (snapshot.metadata as Record<string, any>) || null,
      
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async getCurrentContext(userId: string): Promise<ContextSnapshotResponseDto> {
    const latest = await this.repository.findLatestByUserId(userId);
    if (!latest) {
      throw new NotFoundError('No context snapshot found for this user');
    }
    return this.mapToResponseDto(latest);
  }

  async createSnapshot(userId: string, data: CreateContextSnapshotDto): Promise<ContextSnapshotResponseDto> {
    const created = await this.repository.create(userId, data);
    return this.mapToResponseDto(created);
  }

  async patchContext(userId: string, patchData: PatchContextSnapshotDto): Promise<ContextSnapshotResponseDto> {
    let baseData: CreateContextSnapshotDto = {
      battery: 100,
      charging: false,
      activity: 'idle',
      timeOfDay: 'morning',
      visibility: 'visible',
      network: 'online',
      location: null,
      motion: null,
      heartRate: null,
      currentTask: null,
      focusLevel: null,
      calendarStatus: null,
      workingMode: null,
      deviceStatus: null,
      manualNotes: null,
      metadata: null,
    };

    const latest = await this.repository.findLatestByUserId(userId);
    if (latest) {
      baseData = {
        battery: latest.battery,
        charging: latest.charging,
        activity: latest.activity,
        timeOfDay: latest.timeOfDay,
        visibility: latest.visibility,
        network: latest.network,
        location: latest.location,
        motion: latest.motion,
        heartRate: latest.heartRate,
        currentTask: latest.currentTask,
        focusLevel: latest.focusLevel,
        calendarStatus: latest.calendarStatus,
        workingMode: latest.workingMode,
        deviceStatus: latest.deviceStatus,
        manualNotes: latest.manualNotes,
        metadata: (latest.metadata as Record<string, any>) || null,
      };
    }

    const mergedData = {
      ...baseData,
      ...patchData,
      metadata: (baseData.metadata || patchData.metadata)
        ? { ...(baseData.metadata || {}), ...(patchData.metadata || {}) }
        : null,
    };

    const parsed = CreateContextSnapshotSchema.parse(mergedData);
    return this.createSnapshot(userId, parsed);
  }

  async getContextHistory(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: ContextSnapshotResponseDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const { items, total } = await this.repository.findManyByUserId(userId, skip, limit);
    
    return {
      items: items.map(item => this.mapToResponseDto(item)),
      total,
      page,
      limit,
    };
  }

  async deleteCurrentContext(userId: string): Promise<ContextSnapshotResponseDto> {
    const deleted = await this.repository.deleteLatestByUserId(userId);
    if (!deleted) {
      throw new NotFoundError('No context snapshot found to delete');
    }
    return this.mapToResponseDto(deleted);
  }
}
