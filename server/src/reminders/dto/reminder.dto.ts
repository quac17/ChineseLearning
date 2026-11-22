import { IsBoolean } from 'class-validator';

export class ReminderSettingsDto {
  @IsBoolean({ message: 'Giá trị bật/tắt không hợp lệ' })
  enabled: boolean;
}
