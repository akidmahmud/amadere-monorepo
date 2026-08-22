import { ApiProperty } from '@nestjs/swagger';

// These exist purely so Swagger emits schema components; the runtime shape
// is whatever FooterService.getPublic returns. openapi-typescript only sees
// classes, not the bare PublicFooter interface, so without this mirror the
// storefront would have no generated type and would hand-maintain a
// duplicate that silently drifts (see task-5-brief.md).

export class PublicFooterLinkDto {
  @ApiProperty() label!: string;
  @ApiProperty() href!: string;
  @ApiProperty() newTab!: boolean;
}

export class PublicFooterColumnDto {
  @ApiProperty() heading!: string;
  @ApiProperty({ type: PublicFooterLinkDto, isArray: true })
  links!: PublicFooterLinkDto[];
}

export class PublicFooterSocialDto {
  @ApiProperty() icon!: string;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() url!: string;
  @ApiProperty() label!: string;
}

export class PublicFooterAppButtonDto {
  @ApiProperty() style!: string;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() url!: string;
  @ApiProperty() lineOne!: string;
  @ApiProperty() lineTwo!: string;
}

export class PublicFooterAppsDto {
  @ApiProperty() downloadLabel!: string;
  @ApiProperty({ type: PublicFooterAppButtonDto, isArray: true })
  buttons!: PublicFooterAppButtonDto[];
}

export class PublicFooterContactRowDto {
  @ApiProperty() label!: string;
  @ApiProperty() value!: string;
}

export class PublicFooterContactDto {
  @ApiProperty({ type: PublicFooterContactRowDto }) address!: PublicFooterContactRowDto;
  @ApiProperty({ type: PublicFooterContactRowDto }) phone!: PublicFooterContactRowDto;
  @ApiProperty({ type: PublicFooterContactRowDto }) email!: PublicFooterContactRowDto;
  @ApiProperty({ type: PublicFooterContactRowDto }) hours!: PublicFooterContactRowDto;
}

export class PublicFooterPaymentDto {
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
}

export class PublicFooterLogoDto {
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
}

export class PublicFooterDto {
  @ApiProperty() brandMark!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: PublicFooterContactDto }) contact!: PublicFooterContactDto;
  @ApiProperty({ type: PublicFooterSocialDto, isArray: true }) social!: PublicFooterSocialDto[];
  @ApiProperty({ type: PublicFooterAppsDto }) apps!: PublicFooterAppsDto;
  @ApiProperty({ type: PublicFooterColumnDto, isArray: true }) columns!: PublicFooterColumnDto[];
  @ApiProperty({ type: PublicFooterPaymentDto }) payment!: PublicFooterPaymentDto;
  @ApiProperty() copyright!: string;
  @ApiProperty({ type: PublicFooterLogoDto }) logo!: PublicFooterLogoDto;
}
