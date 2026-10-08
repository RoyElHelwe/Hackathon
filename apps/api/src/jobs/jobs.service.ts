import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { config } from '../config';
import { ClassroomService } from '../classroom/classroom.service';
import { CoursesService } from '../courses/courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { PeerReviewsService } from '../peer-reviews/peer-reviews.service';
import { StuckService } from '../progress/stuck.service';

/** Idempotent background jobs. Disabled with CRON_ENABLED=false (tests). */
@Injectable()
export class JobsService {
  private readonly logger = new Logger('Jobs');

  constructor(
    private readonly classroom: ClassroomService,
    private readonly stuck: StuckService,
    private readonly peers: PeerReviewsService,
    private readonly courses: CoursesService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async rosterSync() {
    if (!config.CRON_ENABLED) return;
    const r = await this.classroom.syncAll();
    this.logger.log(`Roster sync: ${r.length} classes`);
    // Then lessons, for every course with at least one Classroom-linked section (errors isolated per course).
    const linked = await this.prisma.course.findMany({ where: { classes: { some: { classroomCourseId: { not: null } } } }, select: { id: true } });
    let lessons = 0;
    for (const c of linked) lessons += (await this.courses.syncQuietly(c.id))?.lessons ?? 0;
    if (linked.length) this.logger.log(`Lesson sync: ${linked.length} courses, ${lessons} lessons`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async stuckScan() {
    if (!config.CRON_ENABLED) return;
    const n = await this.stuck.scanAll();
    if (n) this.logger.log(`Stuck alerts created: ${n}`);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async peerTimeouts() {
    if (!config.CRON_ENABLED) return;
    const n = await this.peers.handleTimeouts();
    if (n) this.logger.log(`Peer reviews timed out: ${n}`);
  }
}
