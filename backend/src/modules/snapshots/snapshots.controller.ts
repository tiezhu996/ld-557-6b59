import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../types/request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { SnapshotsService } from './snapshots.service';

@ApiTags('snapshots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SnapshotsController {
  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Post('portfolios/:portfolioId/snapshots')
  create(@Param('portfolioId', ParseIntPipe) portfolioId: number, @Body() dto: CreateSnapshotDto, @CurrentUserDecorator() user: CurrentUser) {
    return this.snapshotsService.create(portfolioId, dto, user);
  }

  @Get('portfolios/:portfolioId/snapshots')
  list(@Param('portfolioId', ParseIntPipe) portfolioId: number, @CurrentUserDecorator() user: CurrentUser) {
    return this.snapshotsService.list(portfolioId, user);
  }
}
