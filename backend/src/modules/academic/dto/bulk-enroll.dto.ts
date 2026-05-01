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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentNames?: string[];

  @IsString()
  @IsOptional()
  rawInput?: string;
}
