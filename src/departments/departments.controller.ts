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
import { Roles } from '../common/decorators/roles.decorator';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { QueryDepartmentDto } from './dto/query-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Department created successfully')
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 409,
    description: 'Department name already exists in this church',
  })
  async create(
    @Body() createDepartmentDto: CreateDepartmentDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.create(createDepartmentDto, userChurchId);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('List of departments retrieved successfully')
  @ApiOperation({ summary: 'List departments with pagination and search' })
  @ApiResponse({
    status: 200,
    description: 'List of departments retrieved successfully',
  })
  async findAll(
    @Query() query: QueryDepartmentDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.findAll(query, userChurchId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('Department retrieved successfully')
  @ApiOperation({ summary: 'Get department details and member roster by ID' })
  @ApiResponse({
    status: 200,
    description: 'Department retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.findOne(id, userChurchId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ResponseMessage('Department updated successfully')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 409, description: 'Department name conflict' })
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.update(
      id,
      updateDepartmentDto,
      userChurchId,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ResponseMessage('Department deleted successfully')
  @ApiOperation({ summary: 'Delete a department' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.remove(id, userChurchId);
  }

  @Post(':id/members')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Member assigned to department successfully')
  @ApiOperation({ summary: 'Assign a person to a department' })
  @ApiResponse({ status: 200, description: 'Member assigned successfully' })
  @ApiResponse({ status: 404, description: 'Department or person not found' })
  async addMember(
    @Param('id') id: string,
    @Body() addDepartmentMemberDto: AddDepartmentMemberDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.addMember(
      id,
      addDepartmentMemberDto,
      userChurchId,
    );
  }

  @Delete(':id/members/:personId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ResponseMessage('Member removed from department successfully')
  @ApiOperation({ summary: 'Remove a person from a department' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({
    status: 404,
    description: 'Department or membership not found',
  })
  async removeMember(
    @Param('id') id: string,
    @Param('personId') personId: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.departmentsService.removeMember(id, personId, userChurchId);
  }
}
