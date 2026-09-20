import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSnapshotDto {
  @ApiProperty({ description: '客户端幂等键，同组合同键重试回读原快照', example: 'req-7c31a2f9' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientRequestId: string;
}
