import { Module } from '@nestjs/common';
import { InvitesController, MembershipsController, SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  controllers: [SchoolsController, MembershipsController, InvitesController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
