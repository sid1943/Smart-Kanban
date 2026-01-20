import { ContentType, EnrichedData, UpcomingContent } from '../engine/types';

export interface TaskLabel {
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type?: string;
  isUpload?: boolean;
}

export interface ExtractedLink {
  url: string;
  text?: string;
  source: 'description' | 'attachment' | 'name' | 'comment' | 'checklist';
  cardTitle?: string;
  checklistName?: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  date: string;
}

export interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  category?: string;
  link?: string;
  linkText?: string;
  description?: string;
  dueDate?: string;
  startDate?: string;
  priority?: 'low' | 'medium' | 'high';
  labels?: TaskLabel[];
  checklistTotal?: number;
  checklistChecked?: number;
  checklists?: Checklist[];
  attachments?: Attachment[];
  comments?: Comment[];
  coverColor?: string;
  coverImage?: string;
  coverAttachmentId?: string;
  assignees?: string[];
  position?: number;
  links?: ExtractedLink[];
  contentType?: ContentType;
  contentTypeConfidence?: number;
  contentTypeManual?: boolean;
  hasNewContent?: boolean;
  upcomingContent?: UpcomingContent;
  showStatus?: 'ongoing' | 'ended' | 'upcoming';
  cachedEnrichment?: {
    data: EnrichedData;
    fetchedAt: string;
  };
}
