import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CreatePersonDto } from './dto/create-person.dto';
import { QueryPersonDto } from './dto/query-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PeopleService } from './people.service';

@ApiTags('People')
@ApiBearerAuth()
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Person created successfully')
  @ApiOperation({ summary: 'Create a new person record' })
  @ApiResponse({ status: 201, description: 'Person created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Church not found' })
  async create(
    @Body() createPersonDto: CreatePersonDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.peopleService.create(createPersonDto, userChurchId);
  }

  @Get()
  @ResponseMessage('List of people retrieved successfully')
  @ApiOperation({ summary: 'List people with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'List of people retrieved successfully',
  })
  async findAll(
    @Query() query: QueryPersonDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.peopleService.findAll(query, userChurchId);
  }

  @Get(':id')
  @ResponseMessage('Person retrieved successfully')
  @ApiOperation({ summary: 'Get a person by ID' })
  @ApiResponse({ status: 200, description: 'Person retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.peopleService.findOne(id, userChurchId);
  }

  @Patch(':id')
  @ResponseMessage('Person updated successfully')
  @ApiOperation({ summary: 'Update a person record' })
  @ApiResponse({ status: 200, description: 'Person updated successfully' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePersonDto: UpdatePersonDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.peopleService.update(id, updatePersonDto, userChurchId);
  }

  @Delete(':id')
  @ResponseMessage('Person deleted successfully')
  @ApiOperation({ summary: 'Delete a person record' })
  @ApiResponse({ status: 200, description: 'Person deleted successfully' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.peopleService.remove(id, userChurchId);
  }
}
