import { Module } from '@nestjs/common';
import { ScripturesController } from './scriptures.controller';
import { ScripturesService } from './scriptures.service';

@Module({
  controllers: [ScripturesController],
  providers: [ScripturesService],
  exports: [ScripturesService],
})
export class ScripturesModule {}
