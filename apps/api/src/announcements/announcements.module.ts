import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';

/** School announcements (sent from Ask Arzino). */
@Module({ providers: [AnnouncementsService], exports: [AnnouncementsService] })
export class AnnouncementsModule {}
