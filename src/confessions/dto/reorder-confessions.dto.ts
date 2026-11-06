import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderConfessionsDto {
  @ApiProperty({
    description:
      'Array of all confession IDs for the church in their desired order',
    type: [String],
    example: ['id-a', 'id-b', 'id-c'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'ids array must not be empty' })
  @ArrayUnique({ message: 'ids array must not contain duplicate values' })
  @IsString({ each: true, message: 'each id must be a string' })
  ids: string[];
}
