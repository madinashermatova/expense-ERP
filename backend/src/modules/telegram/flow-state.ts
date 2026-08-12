/**
 * Sahna holati (TZ 3.12.3 — "bot sessiya holati Redis da saqlanadi; bot qayta
 * ishga tushsa oqim yo'qolmaydi").
 *
 * Holat **diskriminatsiyalangan union**: har oqim o'z qadamlari va o'z ma'lumotini
 * saqlaydi, ya'ni bir oqimning maydoni boshqasiga tasodifan o'tib ketmaydi.
 */
export interface LoginFlow {
  name: 'login';
  step: 'login' | 'password' | 'company';
  login?: string;
  /** "➕ Boshqa hisob qo'shish" dan kelgan oqim — muvaffaqiyatdan keyin xabar boshqa */
  addAccount?: boolean;
  /**
   * Bir login bir nechta kompaniyada topilganda tanlash uchun nomzodlar.
   * **Parol saqlanmaydi** — u oldingi qadamda tekshirilgan, `verifiedAt` esa shu
   * tekshiruv qancha vaqt oldin bo'lganini bildiradi (eskirsa oqim boshdan boshlanadi).
   */
  companyOptions?: { userId: string; companyName: string }[];
  verifiedAt?: string;
}

export type FlowState = LoginFlow;

export function isFlow<N extends FlowState['name']>(
  flow: FlowState | null,
  name: N,
): flow is Extract<FlowState, { name: N }> {
  return flow !== null && flow.name === name;
}
