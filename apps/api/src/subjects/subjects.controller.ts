import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Can('read', 'self')
  @Get()
  list() {
    return this.subjects.list();
  }

  @Can('read', 'progress')
  @Get(':key/graph')
  graph(@Auth() a: AuthContext, @Param('key') key: string, @Query('studentId') studentId?: string) {
    return this.subjects.graph(a, key, studentId);
  }
}
