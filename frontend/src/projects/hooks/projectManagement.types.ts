export type NoticeTone = "info" | "warning";

export interface NoticeState {
  text: string;
  tone: NoticeTone;
}
