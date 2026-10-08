import { Global, Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

/** Global: submissions read photo bytes for the AI check. */
@Global()
@Module({ controllers: [UploadsController], providers: [UploadsService], exports: [UploadsService] })
export class UploadsModule {}
