import { Module } from '@nestjs/common';
import { MissionsModule } from '../missions/missions.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';

@Module({ imports: [SubmissionsModule, MissionsModule], controllers: [FamiliesController], providers: [FamiliesService] })
export class FamiliesModule {}
