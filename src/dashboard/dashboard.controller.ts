import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardDataDto } from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ResponseMessage('Dashboard stats retrieved successfully')
  @ApiOperation({
    summary:
      'Get aggregate app statistics, latest registrations, and upcoming events',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats retrieved successfully',
    type: DashboardDataDto,
  })
  async getDashboardStats(
    @CurrentUser('churchId') churchId: string,
  ): Promise<DashboardDataDto> {
    return this.dashboardService.getDashboardStats(churchId);
  }
}
