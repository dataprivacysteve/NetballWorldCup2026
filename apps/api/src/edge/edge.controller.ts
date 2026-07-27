import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EdgeSyncBatchDto } from './edge.dto';
import { EdgeGuard } from './edge.guard';
import { EdgeService } from './edge.service';

@Controller('edge')
@UseGuards(EdgeGuard)
export class EdgeController {
  constructor(private readonly edge: EdgeService) {}

  @Get('bootstrap')
  bootstrap(@Headers('x-gameday-edge-node') nodeId: string) {
    return this.edge.bootstrap(nodeId);
  }

  @Get('matches/:id/export')
  exportMatch(
    @Headers('x-gameday-edge-node') nodeId: string,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Query('after', new ParseIntPipe({ optional: true })) after = 0,
  ) {
    return this.edge.exportMatch(nodeId, matchId, after);
  }

  @Post('matches/sync')
  sync(
    @Headers('x-gameday-edge-node') nodeId: string,
    @Body() dto: EdgeSyncBatchDto,
  ) {
    return this.edge.syncMatch(nodeId, dto);
  }

  @Post('heartbeat')
  heartbeat(@Headers('x-gameday-edge-node') nodeId: string) {
    return this.edge.heartbeat(nodeId);
  }
}
