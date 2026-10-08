import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { ActorService } from '../common/actor.service';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [JwtModule.register({ global: true, secret: config.JWT_SECRET })],
  controllers: [AuthController, MeController],
  providers: [AuthService, ActorService],
  exports: [AuthService, ActorService],
})
export class AuthModule {}
