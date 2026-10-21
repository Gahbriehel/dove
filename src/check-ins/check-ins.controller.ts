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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { QueryCheckInDto } from './dto/query-check-in.dto';
import { UpdateCheckInDto } from './dto/update-check-in.dto';

@ApiTags('Pastoral Check-ins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Pastoral check-in created successfully')
  @ApiOperation({ summary: 'Create or schedule a pastoral check-in' })
  @ApiResponse({ status: 201, description: 'Check-in created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 404,
    description: 'Person or assigned user not found',
  })
  async create(
    @Body() createCheckInDto: CreateCheckInDto,
    @CurrentUser() currentUser: ActiveUserData,
  ) {
    return this.checkInsService.create(createCheckInDto, currentUser);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('List of pastoral check-ins retrieved successfully')
  @ApiOperation({
    summary: 'List pastoral check-ins with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pastoral check-ins retrieved successfully',
  })
  async findAll(
    @Query() query: QueryCheckInDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.checkInsService.findAll(query, userChurchId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('Pastoral check-in details retrieved successfully')
  @ApiOperation({ summary: 'Retrieve details of a single pastoral check-in' })
  @ApiResponse({
    status: 200,
    description: 'Check-in details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Check-in not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.checkInsService.findOne(id, userChurchId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('Pastoral check-in updated successfully')
  @ApiOperation({
    summary: 'Update a pastoral check-in (status, notes, outcome)',
  })
  @ApiResponse({ status: 200, description: 'Check-in updated successfully' })
  @ApiResponse({ status: 404, description: 'Check-in not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCheckInDto: UpdateCheckInDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.checkInsService.update(id, updateCheckInDto, userChurchId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ResponseMessage('Pastoral check-in deleted successfully')
  @ApiOperation({ summary: 'Delete a pastoral check-in record' })
  @ApiResponse({ status: 200, description: 'Check-in deleted successfully' })
  @ApiResponse({ status: 404, description: 'Check-in not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.checkInsService.remove(id, userChurchId);
  }
}
