import { Global, Module } from '@nestjs/common';
import { config } from '../config';
import { ClassroomController } from './classroom.controller';
import { CLASSROOM_PROVIDER } from './classroom.provider';
import { ClassroomService } from './classroom.service';
import { FakeClassroomProvider } from './fake-classroom.provider';
import { GoogleClassroomProvider } from './google-classroom.provider';

@Global()
@Module({
  controllers: [ClassroomController],
  providers: [
    {
      provide: CLASSROOM_PROVIDER,
      useFactory: () => (config.CLASSROOM_PROVIDER === 'google' ? new GoogleClassroomProvider() : new FakeClassroomProvider()),
    },
    ClassroomService,
  ],
  exports: [ClassroomService, CLASSROOM_PROVIDER],
})
export class ClassroomModule {}
