import { ApiProperty } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class PromotePersonDto {
  @ApiProperty({
    enum: [
      MembershipStatus.MEMBER,
      MembershipStatus.WORKER,
      MembershipStatus.LEADER,
      MembershipStatus.PASTOR,
    ],
    description: 'Target membership status to promote the person to',
    example: MembershipStatus.MEMBER,
  })
  @IsEnum(MembershipStatus)
  @IsNotEmpty()
  membershipStatus: MembershipStatus;
}
