import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { Role } from '../../generated/prisma/enums';
import {
  ApplyEditRequestDto,
  CreateEditRequestDto,
  ListEditRequestsDto,
  RejectEditRequestDto,
} from './dto/edit-request.dto';
import { EditRequestsService, EditRequestView } from './edit-requests.service';

/** TZ 3.8 — tahrirlash murojaatlari */
@Controller('edit-requests')
export class EditRequestsController {
  constructor(private readonly editRequests: EditRequestsService) {}

  @Get()
  list(
    @Query() query: ListEditRequestsDto,
  ): Promise<Paginated<EditRequestView>> {
    return this.editRequests.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EditRequestView> {
    return this.editRequests.findOne(id);
  }

  /** Amalda bot orqali ishchi yuboradi; kanal servis uchun ahamiyatsiz */
  @Post()
  create(@Body() dto: CreateEditRequestDto): Promise<EditRequestView> {
    return this.editRequests.create(dto);
  }

  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Post(':id/apply')
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyEditRequestDto,
  ): Promise<EditRequestView> {
    return this.editRequests.apply(id, dto.changes);
  }

  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEditRequestDto,
  ): Promise<EditRequestView> {
    return this.editRequests.reject(id, dto.reason);
  }
}
