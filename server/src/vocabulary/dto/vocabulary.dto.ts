import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class VocabularyItemDto {
  /**
   * Id of an existing word of this lesson. Kept words keep their id, so
   * learners' review boxes (vocab_reviews) survive an edit. Omit for new words.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @MinLength(1, { message: 'Thiếu chữ Hán' })
  @MaxLength(50, { message: 'Chữ Hán tối đa 50 ký tự' })
  hanzi: string;

  /** Tone marks or numbers ("jiao4" is saved as "jiào"). */
  @IsString()
  @MinLength(1, { message: 'Thiếu pinyin' })
  @MaxLength(120, { message: 'Pinyin tối đa 120 ký tự' })
  pinyin: string;

  @IsString()
  @MinLength(1, { message: 'Thiếu nghĩa tiếng Việt' })
  @MaxLength(255, { message: 'Nghĩa tối đa 255 ký tự' })
  meaningVi: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Câu ví dụ tối đa 500 ký tự' })
  exampleZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Nghĩa câu ví dụ tối đa 500 ký tự' })
  exampleVi?: string;

  /** When true (and an audio file is uploaded), learners hear the uploaded audio instead of browser TTS. */
  @IsOptional()
  @IsBoolean()
  audioOverride?: boolean;
}

/** The whole list of a lesson, in order ("Lưu từ vựng" saves everything at once). */
export class SaveVocabularyDto {
  @IsArray()
  @ArrayMaxSize(200, { message: 'Mỗi bài tối đa 200 từ' })
  @ValidateNested({ each: true })
  @Type(() => VocabularyItemDto)
  items: VocabularyItemDto[];
}
