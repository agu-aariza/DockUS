import { IsArray, IsString, IsOptional, IsEmail } from 'class-validator';

export class BulkEnrollDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  studentEmails?: string[];
}
