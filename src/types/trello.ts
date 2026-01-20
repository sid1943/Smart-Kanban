export interface TrelloCheckItem {
  id: string;
  name: string;
  state: 'complete' | 'incomplete';
  pos: number;
}

export interface TrelloChecklist {
  id: string;
  idCard: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  date: string;
  mimeType?: string;
  isUpload: boolean;
}

export interface TrelloComment {
  id: string;
  idMemberCreator: string;
  data: {
    text: string;
    card?: { id: string; name: string };
  };
  date: string;
  type: string;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  due: string | null;
  start: string | null;
  dueComplete: boolean;
  closed: boolean;
  pos: number;
  idChecklists: string[];
  idMembers: string[];
  labels: TrelloLabel[];
  cover?: {
    color?: string;
    idAttachment?: string;
    idUploadedBackground?: string;
    size?: string;
    brightness?: string;
  };
  badges?: {
    checkItems: number;
    checkItemsChecked: number;
    comments: number;
    attachments: number;
    description: boolean;
  };
  attachments?: TrelloAttachment[];
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloBoard {
  name: string;
  desc: string;
  url?: string;
  shortUrl?: string;
  prefs?: {
    background?: string;
    backgroundImage?: string;
    backgroundImageScaled?: Array<{ url: string; width: number; height: number }>;
  };
  lists: TrelloList[];
  cards: TrelloCard[];
  checklists: TrelloChecklist[];
  actions?: TrelloComment[];
  members?: TrelloMember[];
}
