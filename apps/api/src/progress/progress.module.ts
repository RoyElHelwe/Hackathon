import { Global, Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { StuckService } from './stuck.service';

@Global()
@Module({ providers: [ProgressService, StuckService], exports: [ProgressService, StuckService] })
export class ProgressModule {}
