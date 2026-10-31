/** Stage 1 entry point. Loaded lazily from the stage registry. */
import type { StageContext, StageController } from '../../core/stageApi';
import { StageRuntime } from '../StageRuntime';
import { buildStage1Layout } from './layout';

export function createStage(ctx: StageContext): StageController {
  return new StageRuntime(ctx, buildStage1Layout(ctx.difficulty), { stageNumber: 1, music: 'town' });
}
