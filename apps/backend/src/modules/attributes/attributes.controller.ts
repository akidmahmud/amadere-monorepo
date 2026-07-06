import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AttributesService } from './attributes.service';
import { AttributeDto } from './attributes.mapper';

@ApiTags('attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  @ApiOkResponse({ type: AttributeDto, isArray: true })
  list(): Promise<AttributeDto[]> {
    return this.attributes.list();
  }
}
