import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSnapshotDto {
  @ApiProperty({ example: 'snap-20260920-0001', description: '客户端幂等键，同一用户下唯一' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  clientRequestId: string;
}
