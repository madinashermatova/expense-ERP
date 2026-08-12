import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Endpointni autentifikatsiyasiz ochiq qiladi (login, refresh, health) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
