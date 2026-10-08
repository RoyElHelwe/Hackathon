import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { config } from '../config';
import { ClassroomService } from '../classroom/classroom.service';
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
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async rosterSync() {
    if (!config.CRON_ENABLED) return;
    const r = await this.classroom.syncAll();
    this.logger.log(`Roster sync: ${r.length} classes`);
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
