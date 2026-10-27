export interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
}
export interface Folder {
  id: string;
  categoryId: string;
  name: string;
  order: number;
  deletedAt?: string;
}
export interface TodoItem { id: string; text: string; done: boolean; }
export interface VideoLink {
  id: string;
  title: string;
  url: string;
  tags: string[];
}
export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  categoryId: string;
  folderId: string;
  links: VideoLink[];
  todos?: TodoItem[];
  deletedAt?: string;
}
export const categories: Category[] = [
  {
    id: "money",
    name: "お金",
    color: "green",
    description: "未来のために、少しずつ。",
  },
  {
    id: "study",
    name: "勉強",
    color: "blue",
    description: "学びを、自分の力に。",
  },
  {
    id: "work",
    name: "仕事",
    color: "purple",
    description: "アイデアを、次の一歩に。",
  },
  {
    id: "life",
    name: "生活",
    color: "orange",
    description: "毎日の、小さな発見。",
  },
];
export const folderNames = [
  ["収入・支出", "貯金", "投資", "欲しいもの"],
  ["大学の授業", "資格勉強", "学習動画", "読書"],
  ["就職活動", "アルバイト", "ビジネスアイデア", "将来の目標"],
  ["日記", "旅行", "筋トレ", "趣味"],
];

export type Annotation =
  | {
      id: string;
      kind: "text";
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
    }
  | {
      id: string;
      kind: "stroke";
      points: [number, number][];
      color: string;
      size: number;
    };
export interface Attachment {
  id: string;
  noteId: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
  annotations: Annotation[];
}
