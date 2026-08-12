import { Role } from '../../generated/prisma/enums';

/** Bot ga kelgan yangilanishning transportdan mustaqil ko'rinishi */
export interface BotUpdate {
  botId: string;
  telegramId: bigint;
  /** Telegram da shaxsiy chatda `chatId === telegramId`, lekin ataylab alohida */
  chatId: number;
  messageId?: number;
  text?: string;
  callbackData?: string;
  callbackId?: string;
  photoFileId?: string;
  documentFileId?: string;
  documentName?: string;
  documentMimeType?: string;
  fileSize?: number;
}

export interface InlineButton {
  text: string;
  data: string;
}

export interface ReplyOptions {
  /** Pastdagi doimiy klaviatura (menyu) */
  keyboard?: string[][];
  /** Xabar ostidagi inline tugmalar */
  inline?: InlineButton[][];
}

/**
 * Telegram ga chiqish nuqtasi. Sahnalar shu interfeys bilan ishlaydi, ya'ni
 * testlarda tarmoqqa chiqmasdan yozilgan xabarlarni tekshirish mumkin.
 */
export interface BotTransport {
  sendMessage(
    chatId: number,
    text: string,
    options?: ReplyOptions,
  ): Promise<void>;
  deleteMessage(chatId: number, messageId: number): Promise<void>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
}

/** Faol hisob — barcha amallar konteksti shundan olinadi (TZ 3.12.2) */
export interface ActiveAccount {
  linkId: string;
  userId: string;
  companyId: string;
  companyName: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
  fullName: string;
  employeeId: string | null;
}
