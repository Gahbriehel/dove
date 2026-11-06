import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderGivingAccountsDto {
  @ApiProperty({
    description: 'Array of giving account IDs in their desired order',
    type: [String],
    example: ['id-1', 'id-2', 'id-3'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'ids array must not be empty' })
  @ArrayUnique({ message: 'ids array must not contain duplicate values' })
  @IsString({ each: true, message: 'each id must be a string' })
  ids: string[];
}
