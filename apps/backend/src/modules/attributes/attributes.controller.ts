import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttributesService } from './attributes.service';

@ApiTags('attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  list() {
    return this.attributes.list();
  }
}
