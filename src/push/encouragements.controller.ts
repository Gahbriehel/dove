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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateEncouragementDto,
  UpdateEncouragementDto,
} from './dto/encouragement.dto';
import { EncouragementsService } from './encouragements.service';

@ApiTags('Encouragements')
@Controller('encouragements')
export class EncouragementsController {
  constructor(private readonly encouragementsService: EncouragementsService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Encouragement messages retrieved successfully')
  @ApiOperation({
    summary: 'List encouragement messages for the church (Admin only)',
  })
  async findAll(@CurrentUser() user: ActiveUserData) {
    return this.encouragementsService.findAll(user.churchId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Encouragement message created successfully')
  @ApiOperation({
    summary: 'Create a new encouragement message (Admin only)',
  })
  async create(
    @Body() dto: CreateEncouragementDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.encouragementsService.create(user.churchId, dto);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Encouragement message retrieved successfully')
  @ApiOperation({
    summary: 'Get an encouragement message by ID (Admin only)',
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.encouragementsService.findOne(id, user.churchId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Encouragement message updated successfully')
  @ApiOperation({
    summary: 'Update an encouragement message (Admin only)',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEncouragementDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.encouragementsService.update(id, user.churchId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Encouragement message updated successfully')
  @ApiOperation({
    summary: 'Update an encouragement message (Admin only)',
  })
  async updatePut(
    @Param('id') id: string,
    @Body() dto: UpdateEncouragementDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.encouragementsService.update(id, user.churchId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Encouragement message deleted successfully')
  @ApiOperation({
    summary: 'Delete an encouragement message (Admin only)',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.encouragementsService.remove(id, user.churchId);
  }
}
