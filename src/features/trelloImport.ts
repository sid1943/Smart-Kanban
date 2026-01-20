import {
  TrelloBoard,
  TrelloChecklist,
  TrelloList,
} from '../types/trello';
import {
  Attachment,
  Checklist,
  Comment,
  ExtractedLink,
  TaskItem,
  TaskLabel,
} from '../types/tasks';

export interface TrelloImportStats {
  totalChecklists: number;
  totalAttachments: number;
  totalComments: number;
  totalLinks: number;
}

export interface TrelloParseResult {
  tasks: TaskItem[];
  openLists: TrelloList[];
  boardBackgroundImage?: string;
  goalType: string;
  detectedBoardType: string;
  boardName: string;
  boardUrl?: string;
  stats: TrelloImportStats;
}

export function extractUrlsFromText(text: string): Array<{ url: string; text?: string }> {
  const links: Array<{ url: string; text?: string }> = [];

  // Match markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }

  // Match plain URLs (not already captured in markdown)
  const urlRegex = /(?<!\]\()https?:\/\/[^\s\])<>]+/g;
  while ((match = urlRegex.exec(text)) !== null) {
    const urlMatch = match[0];
    if (!links.some(l => l.url === urlMatch)) {
      try {
        const domain = new URL(urlMatch).hostname.replace('www.', '');
        links.push({ url: urlMatch, text: domain });
      } catch {
        links.push({ url: urlMatch });
      }
    }
  }

  return links;
}

export function parseTrelloExport(
  data: TrelloBoard,
  options: { maxBackgroundWidth: number }
): TrelloParseResult {
  const openLists = data.lists.filter(l => !l.closed).sort((a, b) => a.pos - b.pos);
  const tasks: TaskItem[] = [];

  const listMap = new Map<string, string>();
  openLists.forEach(list => listMap.set(list.id, list.name));

  const checklistMap = new Map<string, TrelloChecklist>();
  (data.checklists || []).forEach(cl => checklistMap.set(cl.id, cl));

  const checklistsByCard = new Map<string, TrelloChecklist[]>();
  (data.checklists || []).forEach(cl => {
    const existing = checklistsByCard.get(cl.idCard) || [];
    existing.push(cl);
    checklistsByCard.set(cl.idCard, existing);
  });

  const memberMap = new Map<string, string>();
  (data.members || []).forEach(m => memberMap.set(m.id, m.fullName || m.username));

  const commentsByCard = new Map<string, Comment[]>();
  (data.actions || [])
    .filter(a => a.type === 'commentCard' && a.data.card)
    .forEach(action => {
      const cardId = action.data.card?.id;
      if (cardId) {
        const existing = commentsByCard.get(cardId) || [];
        existing.push({
          id: action.id,
          text: action.data.text,
          author: memberMap.get(action.idMemberCreator) || 'Unknown',
          date: action.date,
        });
        commentsByCard.set(cardId, existing);
      }
    });

  const sortedCards = data.cards
    .filter(c => !c.closed)
    .sort((a, b) => a.pos - b.pos);

  sortedCards.forEach(card => {
    const listName = listMap.get(card.idList) || 'imported';
    const categoryKey = listName.toLowerCase().replace(/\s+/g, '_');

    const taskLabels: TaskLabel[] = (card.labels || []).map(label => ({
      name: label.name || label.color,
      color: label.color,
    }));

    let rawChecklists: TrelloChecklist[] = [];
    if (card.idChecklists && card.idChecklists.length > 0) {
      rawChecklists = card.idChecklists
        .map(clId => checklistMap.get(clId))
        .filter((cl): cl is TrelloChecklist => cl !== undefined);
    } else {
      rawChecklists = checklistsByCard.get(card.id) || [];
    }

    const cardChecklists: Checklist[] = rawChecklists
      .sort((a, b) => a.pos - b.pos)
      .map(cl => ({
        id: cl.id,
        name: cl.name,
        items: (cl.checkItems || [])
          .sort((a, b) => a.pos - b.pos)
          .map(item => ({
            id: item.id,
            text: item.name,
            checked: item.state === 'complete',
          })),
      }));

    const checklistTotal = cardChecklists.reduce((sum, cl) => sum + cl.items.length, 0);
    const checklistChecked = cardChecklists.reduce(
      (sum, cl) => sum + cl.items.filter(i => i.checked).length,
      0
    );

    const attachments: Attachment[] = (card.attachments || []).map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      type: att.mimeType,
      isUpload: att.isUpload,
    }));

    const comments = commentsByCard.get(card.id) || [];

    const assignees = (card.idMembers || [])
      .map(mId => memberMap.get(mId))
      .filter((name): name is string => name !== undefined);

    let coverColor: string | undefined;
    let coverAttachmentId: string | undefined;
    if (card.cover) {
      coverColor = card.cover.color;
      if (card.cover.idAttachment) {
        coverAttachmentId = card.cover.idAttachment;
      }
    }

    const extractedLinks: ExtractedLink[] = [];
    const cardTitle = card.name;

    const nameLinks = extractUrlsFromText(card.name);
    nameLinks.forEach(l => extractedLinks.push({ ...l, source: 'name', cardTitle }));

    if (card.desc) {
      const descLinks = extractUrlsFromText(card.desc);
      descLinks.forEach(l => extractedLinks.push({ ...l, source: 'description', cardTitle }));
    }

    (card.attachments || [])
      .filter(att => !att.isUpload)
      .forEach(att => {
        if (!extractedLinks.some(l => l.url === att.url)) {
          extractedLinks.push({
            url: att.url,
            text: att.name,
            source: 'attachment',
            cardTitle,
          });
        }
      });

    comments.forEach(comment => {
      const commentLinks = extractUrlsFromText(comment.text);
      commentLinks.forEach(l => {
        if (!extractedLinks.some(el => el.url === l.url)) {
          extractedLinks.push({ ...l, source: 'comment', cardTitle });
        }
      });
    });

    cardChecklists.forEach(checklist => {
      checklist.items.forEach(item => {
        const itemLinks = extractUrlsFromText(item.text);
        itemLinks.forEach(l => {
          if (!extractedLinks.some(el => el.url === l.url)) {
            extractedLinks.push({
              ...l,
              source: 'checklist',
              cardTitle,
              checklistName: checklist.name,
            });
          }
        });
      });
    });

    const isFullyComplete = checklistTotal > 0 && checklistChecked === checklistTotal;
    tasks.push({
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: card.name,
      checked: card.dueComplete || isFullyComplete || false,
      category: categoryKey,
      description: card.desc || undefined,
      labels: taskLabels.length > 0 ? taskLabels : undefined,
      checklistTotal: checklistTotal > 0 ? checklistTotal : undefined,
      checklistChecked: checklistTotal > 0 ? checklistChecked : undefined,
      checklists: cardChecklists.length > 0 ? cardChecklists : undefined,
      dueDate: card.due || undefined,
      startDate: card.start || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      comments: comments.length > 0 ? comments : undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
      coverColor,
      coverAttachmentId,
      position: card.pos,
      links: extractedLinks.length > 0 ? extractedLinks : undefined,
    });
  });

  const boardNameLower = (data.name || '').toLowerCase();
  const allCardText = data.cards.map(c => c.name.toLowerCase()).join(' ');
  const allListNames = openLists.map(l => l.name.toLowerCase()).join(' ');

  const isMediaBoard =
    boardNameLower.match(/\b(tv|show|series|movie|film|anime|watch|drama|episode)\b/) ||
    allListNames.match(/\b(to watch|watching|watched|backlog|queue|completed|finished|dropped)\b/) ||
    allCardText.match(/\b(season|episode|s\d+e\d+|ep\s*\d+)\b/);

  let goalType = 'media';
  let detectedBoardType = 'general';

  if (isMediaBoard) {
    detectedBoardType = 'media';
    if (boardNameLower.includes('anime')) detectedBoardType = 'anime';
    else if (boardNameLower.includes('movie') || boardNameLower.includes('film')) detectedBoardType = 'movies';
    else if (boardNameLower.match(/\b(tv|show|series|drama)\b/)) detectedBoardType = 'tvshows';
  } else if (boardNameLower.includes('travel') || boardNameLower.includes('trip')) {
    goalType = 'travel';
    detectedBoardType = 'travel';
  } else if (boardNameLower.includes('learn') || boardNameLower.includes('study')) {
    goalType = 'learning';
    detectedBoardType = 'learning';
  } else if (boardNameLower.includes('fitness') || boardNameLower.includes('health')) {
    goalType = 'fitness';
    detectedBoardType = 'fitness';
  } else if (boardNameLower.includes('cook') || boardNameLower.includes('recipe')) {
    goalType = 'cooking';
    detectedBoardType = 'cooking';
  } else if (boardNameLower.includes('work') || boardNameLower.includes('job')) {
    goalType = 'job';
    detectedBoardType = 'work';
  } else if (boardNameLower.includes('book') || boardNameLower.includes('read')) {
    goalType = 'media';
    detectedBoardType = 'books';
  } else if (boardNameLower.includes('game') || boardNameLower.includes('gaming')) {
    goalType = 'media';
    detectedBoardType = 'games';
  }

  if (detectedBoardType === 'media' || detectedBoardType === 'tvshows' ||
      detectedBoardType === 'movies' || detectedBoardType === 'anime' ||
      detectedBoardType === 'books' || detectedBoardType === 'games') {
    const categoryMapping: Record<string, string> = {
      'to watch': 'to_watch',
      'want to watch': 'to_watch',
      'backlog': 'to_watch',
      'queue': 'to_watch',
      'plan to watch': 'to_watch',
      'watching': 'watching',
      'in progress': 'watching',
      'currently watching': 'watching',
      'started': 'watching',
      'watched': 'watched',
      'completed': 'watched',
      'finished': 'watched',
      'done': 'watched',
      'dropped': 'dropped',
      'on hold': 'on_hold',
      'paused': 'on_hold',
    };

    tasks.forEach(task => {
      const originalCat = task.category || '';
      const normalizedCat = originalCat.toLowerCase().replace(/_/g, ' ');
      if (categoryMapping[normalizedCat]) {
        task.category = categoryMapping[normalizedCat];
      }
    });
  }

  let boardBackgroundImage: string | undefined;
  if (data.prefs?.backgroundImageScaled && data.prefs.backgroundImageScaled.length > 0) {
    const sorted = [...data.prefs.backgroundImageScaled].sort((a, b) => a.width - b.width);
    const candidate = sorted.filter(img => img.width <= options.maxBackgroundWidth).pop() || sorted[0];
    boardBackgroundImage = candidate.url;
  } else if (data.prefs?.backgroundImage) {
    boardBackgroundImage = data.prefs.backgroundImage;
  }

  const stats: TrelloImportStats = {
    totalChecklists: tasks.reduce((sum, t) => sum + (t.checklists?.length || 0), 0),
    totalAttachments: tasks.reduce((sum, t) => sum + (t.attachments?.length || 0), 0),
    totalComments: tasks.reduce((sum, t) => sum + (t.comments?.length || 0), 0),
    totalLinks: tasks.reduce((sum, t) => sum + (t.links?.length || 0), 0),
  };

  return {
    tasks,
    openLists,
    boardBackgroundImage,
    goalType,
    detectedBoardType,
    boardName: data.name || 'Imported Trello Board',
    boardUrl: data.url || '',
    stats,
  };
}
