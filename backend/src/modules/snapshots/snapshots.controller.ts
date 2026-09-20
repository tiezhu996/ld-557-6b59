import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../types/request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { SnapshotsService } from './snapshots.service';

@ApiTags('snapshots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class SnapshotsController {
  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Post(':id/snapshots')
  @ApiOperation({ summary: '创建组合估值快照（clientRequestId 幂等）' })
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSnapshotDto,
    @CurrentUserDecorator() user: CurrentUser,
  ) {
    return this.snapshotsService.create(id, dto, user);
  }

  @Get(':id/snapshots')
  @ApiOperation({ summary: '回读组合的历史估值快照列表' })
  list(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return this.snapshotsService.list(id, user);
  }
}
