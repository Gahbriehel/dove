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
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { PreviewMessageTemplateDto } from './dto/preview-message-template.dto';
import { QueryMessageTemplateDto } from './dto/query-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageTemplatesService } from './message-templates.service';

@ApiTags('Message Templates')
@ApiBearerAuth()
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly templatesService: MessageTemplatesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('Message templates retrieved successfully')
  @ApiOperation({ summary: 'List message templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  findAll(
    @Query() query: QueryMessageTemplateDto,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.templatesService.findAll(query, churchId);
  }

  @Post('preview')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Template preview generated successfully')
  @ApiOperation({
    summary: 'Render a template body with sample values for a live preview',
  })
  preview(
    @Body() dto: PreviewMessageTemplateDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.templatesService.preview(dto.body, userId, churchId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Message template created successfully')
  @ApiOperation({ summary: 'Create a message template' })
  @ApiResponse({ status: 400, description: 'Unknown placeholder or reason' })
  create(
    @Body() dto: CreateMessageTemplateDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.templatesService.create(dto, userId, churchId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ResponseMessage('Message template updated successfully')
  @ApiOperation({ summary: 'Update a message template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.templatesService.update(id, dto, churchId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ResponseMessage('Message template removed successfully')
  @ApiOperation({
    summary:
      'Delete a template. Templates already used in outreach are deactivated instead.',
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  remove(@Param('id') id: string, @CurrentUser('churchId') churchId: string) {
    return this.templatesService.remove(id, churchId);
  }
}
