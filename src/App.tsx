import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNewContentScanner } from './hooks/useNewContentScanner';
import { enrichFromTMDb } from './engine/enrichment/tmdb';
import { UpcomingContent } from './engine/types';
import { getContentKindLabel, isUpcoming, getNewContentOrchestrator, ChecklistInfo } from './engine/detection';
import { getOrchestrator } from './engine/agents/AgentOrchestrator';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import { IdeasView } from './components/IdeasView';
import TaskDetailModal from './components/TaskDetailModal';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskLabel {
  name: string;
  color: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type?: string;
  isUpload?: boolean;
}

interface ExtractedLink {
  url: string;
  text?: string;
  source: 'description' | 'attachment' | 'name' | 'comment' | 'checklist';
  cardTitle?: string;  // The card/task title this link belongs to
  checklistName?: string;  // If from a checklist, which checklist
}

interface Comment {
  id: string;
  text: string;
  author: string;
  date: string;
}

// Content types for Smart Insights
type ContentType = 'tv_series' | 'movie' | 'anime' | 'book' | 'game' | 'music' | 'unknown';

interface TaskItem {
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
  assignees?: string[];
  position?: number;
  links?: ExtractedLink[];
  // Smart Content Engine fields
  contentType?: ContentType;
  contentTypeConfidence?: number;
  contentTypeManual?: boolean; // true if user manually set it
  hasNewContent?: boolean; // true if new seasons/content detected from API
  upcomingContent?: UpcomingContent;
  showStatus?: 'ongoing' | 'ended' | 'upcoming';
  // Cached enrichment data (persisted to avoid re-fetching)
  cachedEnrichment?: {
    data: import('./engine/types').EnrichedData;
    fetchedAt: string; // ISO timestamp
  };
}

// User's personal info for smart task suggestions
interface UserInfoItem {
  id: string;
  category: 'travel' | 'skills' | 'certifications' | 'personal' | 'other';
  label: string;
  value: string;
  expiryDate?: string;
  dateAdded: number;
  documentName?: string; // Name of attached document
  documentData?: string; // Base64 encoded document
  documentType?: string; // MIME type
}

// Calendar event definition
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  isAllDay: boolean;
  source: 'imported' | 'manual';
  sourceFile?: string;
}

// Parse ICS file content
const parseICS = (content: string, sourceFile: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = content.split(/\r?\n/);

  let currentEvent: Partial<CalendarEvent> | null = null;
  let inEvent = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line folding (lines starting with space/tab are continuations)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[++i].substring(1);
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentEvent = {
        id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: 'imported',
        sourceFile,
        isAllDay: false,
      };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.title && currentEvent.startDate) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
      inEvent = false;
    } else if (inEvent && currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).split(';')[0];
        const value = line.substring(colonIndex + 1);

        switch (key) {
          case 'SUMMARY':
            currentEvent.title = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            break;
          case 'DESCRIPTION':
            currentEvent.description = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            break;
          case 'LOCATION':
            currentEvent.location = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            break;
          case 'DTSTART':
            if (line.includes('VALUE=DATE:') || value.length === 8) {
              currentEvent.isAllDay = true;
              const year = parseInt(value.substring(0, 4));
              const month = parseInt(value.substring(4, 6)) - 1;
              const day = parseInt(value.substring(6, 8));
              currentEvent.startDate = new Date(year, month, day);
            } else {
              const parsed = parseICSDateTime(value);
              if (parsed) currentEvent.startDate = parsed;
            }
            break;
          case 'DTEND':
            if (line.includes('VALUE=DATE:') || value.length === 8) {
              const year = parseInt(value.substring(0, 4));
              const month = parseInt(value.substring(4, 6)) - 1;
              const day = parseInt(value.substring(6, 8));
              currentEvent.endDate = new Date(year, month, day);
            } else {
              const parsed = parseICSDateTime(value);
              if (parsed) currentEvent.endDate = parsed;
            }
            break;
        }
      }
    }
  }

  return events;
};

// Parse ICS datetime format (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
const parseICSDateTime = (value: string): Date | null => {
  try {
    const dateStr = value.replace('Z', '');
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = dateStr.length >= 11 ? parseInt(dateStr.substring(9, 11)) : 0;
    const minute = dateStr.length >= 13 ? parseInt(dateStr.substring(11, 13)) : 0;
    const second = dateStr.length >= 15 ? parseInt(dateStr.substring(13, 15)) : 0;

    if (value.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  } catch {
    return null;
  }
};

// Trello JSON types
interface TrelloCheckItem {
  id: string;
  name: string;
  state: 'complete' | 'incomplete';
  pos: number;
}

interface TrelloChecklist {
  id: string;
  idCard: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  date: string;
  mimeType?: string;
  isUpload: boolean;
}

interface TrelloComment {
  id: string;
  idMemberCreator: string;
  data: {
    text: string;
    card?: { id: string; name: string };
  };
  date: string;
  type: string;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string;
}

interface TrelloCard {
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

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

interface TrelloBoard {
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

// Parse Trello JSON export
interface TrelloImportResult {
  boardName: string;
  goalsCreated: number;
  tasksCreated: number;
  checklistsImported: number;
  attachmentsImported: number;
  commentsImported: number;
  listsImported: number;
  linksExtracted: number;
}

// Workspace definition
interface Workspace {
  id: string;
  name: string;
  color: string;
  backgroundImage?: string;
}

// Default workspaces
const defaultWorkspaces: Workspace[] = [
  { id: 'personal', name: 'Personal', color: '#0079bf' },
  { id: 'travel', name: 'Travel Planning', color: '#519839' },
  { id: 'learning', name: 'Learning & Growth', color: '#b04632' },
  { id: 'projects', name: 'Projects', color: '#89609e' },
];

// Profile field template definition
interface ProfileField {
  id: string;
  label: string;
  category: string; // Changed to string to allow custom categories
  hasExpiry: boolean;
  hasDocument: boolean;
  placeholder: string;
  icon: string;
}

// Profile category definition
interface ProfileCategory {
  id: string;
  name: string;
  icon: string;
}

// Predefined profile templates
const profileTemplates: ProfileField[] = [
  // Travel Documents
  { id: 'passport_number', label: 'Passport Number', category: 'travel', hasExpiry: true, hasDocument: true, placeholder: 'e.g., AB1234567', icon: '🛂' },
  { id: 'passport_country', label: 'Passport Country', category: 'travel', hasExpiry: false, hasDocument: false, placeholder: 'e.g., United States', icon: '🏳️' },
  { id: 'visa_us', label: 'US Visa', category: 'travel', hasExpiry: true, hasDocument: true, placeholder: 'e.g., B1/B2', icon: '🇺🇸' },
  { id: 'visa_schengen', label: 'Schengen Visa', category: 'travel', hasExpiry: true, hasDocument: true, placeholder: 'e.g., Tourist', icon: '🇪🇺' },
  { id: 'travel_insurance', label: 'Travel Insurance', category: 'travel', hasExpiry: true, hasDocument: true, placeholder: 'e.g., World Nomads Policy', icon: '🛡️' },
  { id: 'frequent_flyer', label: 'Frequent Flyer Number', category: 'travel', hasExpiry: false, hasDocument: false, placeholder: 'e.g., AA123456', icon: '✈️' },

  // Identity Documents
  { id: 'drivers_license', label: "Driver's License", category: 'identity', hasExpiry: true, hasDocument: true, placeholder: 'e.g., D1234567', icon: '🚗' },
  { id: 'national_id', label: 'National ID / SSN', category: 'identity', hasExpiry: false, hasDocument: true, placeholder: 'e.g., XXX-XX-XXXX', icon: '🪪' },
  { id: 'birth_certificate', label: 'Birth Certificate', category: 'identity', hasExpiry: false, hasDocument: true, placeholder: 'Certificate number', icon: '📜' },

  // Health
  { id: 'health_insurance', label: 'Health Insurance', category: 'health', hasExpiry: true, hasDocument: true, placeholder: 'e.g., Policy number', icon: '🏥' },
  { id: 'blood_type', label: 'Blood Type', category: 'health', hasExpiry: false, hasDocument: false, placeholder: 'e.g., O+', icon: '🩸' },
  { id: 'allergies', label: 'Allergies', category: 'health', hasExpiry: false, hasDocument: false, placeholder: 'e.g., Penicillin, Peanuts', icon: '⚠️' },
  { id: 'vaccinations', label: 'Vaccination Record', category: 'health', hasExpiry: false, hasDocument: true, placeholder: 'e.g., COVID-19, Yellow Fever', icon: '💉' },

  // Skills & Tools
  { id: 'python_installed', label: 'Python Version', category: 'skills', hasExpiry: false, hasDocument: false, placeholder: 'e.g., 3.12.0', icon: '🐍' },
  { id: 'node_installed', label: 'Node.js Version', category: 'skills', hasExpiry: false, hasDocument: false, placeholder: 'e.g., 20.10.0', icon: '🟢' },
  { id: 'vscode_installed', label: 'VS Code Installed', category: 'skills', hasExpiry: false, hasDocument: false, placeholder: 'e.g., Yes - v1.85', icon: '💻' },
  { id: 'git_installed', label: 'Git Version', category: 'skills', hasExpiry: false, hasDocument: false, placeholder: 'e.g., 2.43.0', icon: '📦' },

  // Education & Certifications
  { id: 'degree', label: 'Highest Degree', category: 'education', hasExpiry: false, hasDocument: true, placeholder: "e.g., Bachelor's in CS", icon: '🎓' },
  { id: 'certification_1', label: 'Certification 1', category: 'education', hasExpiry: true, hasDocument: true, placeholder: 'e.g., AWS Solutions Architect', icon: '📋' },
  { id: 'certification_2', label: 'Certification 2', category: 'education', hasExpiry: true, hasDocument: true, placeholder: 'e.g., PMP', icon: '📋' },
  { id: 'language_1', label: 'Language Proficiency', category: 'education', hasExpiry: false, hasDocument: true, placeholder: 'e.g., Spanish - B2', icon: '🗣️' },
];

// Default profile categories
const defaultProfileCategories: ProfileCategory[] = [
  { id: 'travel', name: 'Travel Documents', icon: '✈️' },
  { id: 'identity', name: 'Identity Documents', icon: '🪪' },
  { id: 'health', name: 'Health Information', icon: '🏥' },
  { id: 'skills', name: 'Skills & Tools', icon: '💻' },
  { id: 'education', name: 'Education & Certifications', icon: '🎓' },
];

// Keywords to match tasks with user info
const taskInfoMatchers: Record<string, { keywords: string[]; infoLabels: string[] }> = {
  passport: {
    keywords: ['passport', 'renew passport', 'check passport', 'passport validity'],
    infoLabels: ['passport expiry', 'passport number', 'passport'],
  },
  visa: {
    keywords: ['visa', 'apply visa', 'visa application', 'check visa'],
    infoLabels: ['visa', 'visa expiry', 'visa status'],
  },
  python: {
    keywords: ['install python', 'python setup', 'download python', 'python installation'],
    infoLabels: ['python installed', 'python version', 'python'],
  },
  javascript: {
    keywords: ['install node', 'node setup', 'javascript', 'npm install'],
    infoLabels: ['node installed', 'node version', 'javascript'],
  },
  vscode: {
    keywords: ['install vs code', 'vscode', 'visual studio code', 'code editor'],
    infoLabels: ['vs code installed', 'vscode', 'code editor'],
  },
  flight: {
    keywords: ['book flight', 'flight booking', 'book tickets', 'flight tickets'],
    infoLabels: ['flight booked', 'flight confirmation', 'flight'],
  },
  hotel: {
    keywords: ['book hotel', 'hotel booking', 'accommodation', 'book stay'],
    infoLabels: ['hotel booked', 'hotel confirmation', 'accommodation'],
  },
  insurance: {
    keywords: ['travel insurance', 'insurance', 'get insurance'],
    infoLabels: ['insurance', 'travel insurance', 'insurance policy'],
  },
};

// Destination-specific resources
const destinationResources: Record<string, {
  visa: { url: string; info: string };
  flights: string[];
  hotels: string[];
  attractions: { name: string; url: string }[];
  restaurants: { name: string; url: string }[];
  tips: string[];
}> = {
  japan: {
    visa: {
      url: 'https://www.mofa.go.jp/j_info/visit/visa/',
      info: 'Most countries get 90-day visa-free entry'
    },
    flights: [
      'https://www.google.com/travel/flights?q=flights+to+japan',
      'https://www.skyscanner.com/transport/flights-to/jp/japan.html',
    ],
    hotels: [
      'https://www.booking.com/country/jp.html',
      'https://www.agoda.com/japan',
    ],
    attractions: [
      { name: 'Tokyo - Shibuya, Senso-ji Temple, teamLab', url: 'https://www.japan-guide.com/e/e2164.html' },
      { name: 'Kyoto - Fushimi Inari, Arashiyama, Gion', url: 'https://www.japan-guide.com/e/e2158.html' },
      { name: 'Osaka - Dotonbori, Osaka Castle', url: 'https://www.japan-guide.com/e/e2157.html' },
      { name: 'Mt. Fuji day trip', url: 'https://www.japan-guide.com/e/e2172.html' },
      { name: 'Hiroshima Peace Memorial', url: 'https://www.japan-guide.com/e/e2160.html' },
    ],
    restaurants: [
      { name: 'Tabelog (Japanese Yelp)', url: 'https://tabelog.com/en/' },
      { name: 'Tokyo Ramen Guide', url: 'https://www.japan-guide.com/e/e3073.html' },
      { name: 'Sushi Restaurants Guide', url: 'https://www.japan-guide.com/e/e2311.html' },
    ],
    tips: [
      'Get JR Pass for train travel: https://japanrailpass.net/',
      'Get Suica/Pasmo card for local transit',
      'Download Japan Official Travel App',
      'Learn basic phrases: Sumimasen (excuse me), Arigatou (thanks)',
    ],
  },
  france: {
    visa: {
      url: 'https://france-visas.gouv.fr/',
      info: 'Schengen visa required for some countries, EU/US/UK visa-free for 90 days'
    },
    flights: [
      'https://www.google.com/travel/flights?q=flights+to+paris',
      'https://www.skyscanner.com/transport/flights-to/pari/paris.html',
    ],
    hotels: [
      'https://www.booking.com/city/fr/paris.html',
      'https://www.airbnb.com/paris-france/stays',
    ],
    attractions: [
      { name: 'Eiffel Tower', url: 'https://www.toureiffel.paris/en' },
      { name: 'Louvre Museum', url: 'https://www.louvre.fr/en' },
      { name: 'Palace of Versailles', url: 'https://en.chateauversailles.fr/' },
      { name: 'Notre-Dame & Île de la Cité', url: 'https://www.notredamedeparis.fr/en/' },
      { name: 'Montmartre & Sacré-Cœur', url: 'https://www.sacre-coeur-montmartre.com/english/' },
    ],
    restaurants: [
      { name: 'La Fourchette (The Fork)', url: 'https://www.thefork.com/' },
      { name: 'Paris by Mouth Food Guide', url: 'https://parisbymouth.com/' },
      { name: 'Le Guide Michelin', url: 'https://guide.michelin.com/en/fr/paris/restaurants' },
    ],
    tips: [
      'Book Eiffel Tower tickets in advance',
      'Get Museum Pass for multiple attractions',
      'Metro is the best way to get around Paris',
      'Learn: Bonjour, Merci, S\'il vous plaît',
    ],
  },
  italy: {
    visa: {
      url: 'https://vistoperitalia.esteri.it/',
      info: 'Schengen visa, EU/US/UK visa-free for 90 days'
    },
    flights: [
      'https://www.google.com/travel/flights?q=flights+to+italy',
      'https://www.skyscanner.com/transport/flights-to/it/italy.html',
    ],
    hotels: [
      'https://www.booking.com/country/it.html',
      'https://www.airbnb.com/italy/stays',
    ],
    attractions: [
      { name: 'Rome - Colosseum, Vatican, Trevi', url: 'https://www.rome.net/' },
      { name: 'Florence - Uffizi, Duomo', url: 'https://www.visitflorence.com/' },
      { name: 'Venice - St. Mark\'s, Grand Canal', url: 'https://www.veneziaunica.it/en' },
      { name: 'Amalfi Coast', url: 'https://www.amalficoast.com/' },
      { name: 'Cinque Terre', url: 'https://www.cinqueterre.eu.com/' },
    ],
    restaurants: [
      { name: 'TripAdvisor Italy Restaurants', url: 'https://www.tripadvisor.com/Restaurants-g187768-Italy.html' },
      { name: 'Gambero Rosso Guide', url: 'https://www.gamberorosso.it/en/' },
    ],
    tips: [
      'Book Vatican & Colosseum tickets in advance',
      'Trains are the best way between cities: https://www.trenitalia.com/',
      'Learn: Ciao, Grazie, Per favore, Scusi',
    ],
  },
  thailand: {
    visa: {
      url: 'https://www.thaiembassy.com/thailand-visa',
      info: 'Many countries get 30-60 day visa exemption'
    },
    flights: [
      'https://www.google.com/travel/flights?q=flights+to+thailand',
      'https://www.skyscanner.com/transport/flights-to/th/thailand.html',
    ],
    hotels: [
      'https://www.agoda.com/thailand',
      'https://www.booking.com/country/th.html',
    ],
    attractions: [
      { name: 'Bangkok - Grand Palace, Wat Pho', url: 'https://www.tourismthailand.org/Destinations/Provinces/Bangkok' },
      { name: 'Chiang Mai - Temples, Night Market', url: 'https://www.tourismthailand.org/Destinations/Provinces/Chiang-Mai' },
      { name: 'Phuket Beaches', url: 'https://www.tourismthailand.org/Destinations/Provinces/Phuket' },
      { name: 'Krabi & Phi Phi Islands', url: 'https://www.tourismthailand.org/Destinations/Provinces/Krabi' },
    ],
    restaurants: [
      { name: 'Bangkok Foodie Guide', url: 'https://www.eatingthaifood.com/' },
      { name: 'Wongnai (Thai Yelp)', url: 'https://www.wongnai.com/' },
    ],
    tips: [
      'Download Grab app for taxis',
      'Street food is amazing and safe',
      'Learn: Sawadee (hello), Khob khun (thanks)',
    ],
  },
  uk: {
    visa: {
      url: 'https://www.gov.uk/check-uk-visa',
      info: 'Check visa requirements - varies by nationality'
    },
    flights: [
      'https://www.google.com/travel/flights?q=flights+to+london',
      'https://www.skyscanner.com/transport/flights-to/lond/london.html',
    ],
    hotels: [
      'https://www.booking.com/city/gb/london.html',
      'https://www.airbnb.com/london-united-kingdom/stays',
    ],
    attractions: [
      { name: 'London - Big Ben, Tower Bridge, British Museum', url: 'https://www.visitlondon.com/' },
      { name: 'Stonehenge', url: 'https://www.english-heritage.org.uk/visit/places/stonehenge/' },
      { name: 'Edinburgh Castle', url: 'https://www.edinburghcastle.scot/' },
      { name: 'Cotswolds', url: 'https://www.cotswolds.com/' },
    ],
    restaurants: [
      { name: 'Time Out London Food', url: 'https://www.timeout.com/london/restaurants' },
      { name: 'OpenTable UK', url: 'https://www.opentable.co.uk/' },
    ],
    tips: [
      'Get Oyster card for London transport',
      'Book trains early: https://www.thetrainline.com/',
      'Tipping is optional (10% for good service)',
    ],
  },
};

// Learning resources
const learningResources: Record<string, {
  beginnerCourses: { name: string; url: string }[];
  documentation: { name: string; url: string }[];
  practice: { name: string; url: string }[];
  communities: { name: string; url: string }[];
}> = {
  python: {
    beginnerCourses: [
      { name: 'Python for Everybody (Coursera - Free)', url: 'https://www.coursera.org/specializations/python' },
      { name: 'Automate the Boring Stuff (Free book)', url: 'https://automatetheboringstuff.com/' },
      { name: 'CS50 Python (Harvard - Free)', url: 'https://cs50.harvard.edu/python/' },
      { name: 'Codecademy Python', url: 'https://www.codecademy.com/learn/learn-python-3' },
    ],
    documentation: [
      { name: 'Official Python Docs', url: 'https://docs.python.org/3/' },
      { name: 'Real Python Tutorials', url: 'https://realpython.com/' },
      { name: 'W3Schools Python', url: 'https://www.w3schools.com/python/' },
    ],
    practice: [
      { name: 'LeetCode', url: 'https://leetcode.com/' },
      { name: 'HackerRank Python', url: 'https://www.hackerrank.com/domains/python' },
      { name: 'Exercism Python Track', url: 'https://exercism.org/tracks/python' },
      { name: 'Codewars', url: 'https://www.codewars.com/' },
    ],
    communities: [
      { name: 'r/learnpython', url: 'https://www.reddit.com/r/learnpython/' },
      { name: 'Python Discord', url: 'https://discord.gg/python' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com/questions/tagged/python' },
    ],
  },
  javascript: {
    beginnerCourses: [
      { name: 'freeCodeCamp JavaScript', url: 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/' },
      { name: 'JavaScript.info', url: 'https://javascript.info/' },
      { name: 'The Odin Project', url: 'https://www.theodinproject.com/' },
    ],
    documentation: [
      { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
      { name: 'W3Schools JavaScript', url: 'https://www.w3schools.com/js/' },
    ],
    practice: [
      { name: 'LeetCode', url: 'https://leetcode.com/' },
      { name: 'Exercism JavaScript', url: 'https://exercism.org/tracks/javascript' },
      { name: 'JavaScript30', url: 'https://javascript30.com/' },
    ],
    communities: [
      { name: 'r/javascript', url: 'https://www.reddit.com/r/javascript/' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com/questions/tagged/javascript' },
    ],
  },
};

// Job search resources
const _jobResources = {
  general: [
    { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/' },
    { name: 'Indeed', url: 'https://www.indeed.com/' },
    { name: 'Glassdoor', url: 'https://www.glassdoor.com/' },
  ],
  tech: [
    { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/' },
    { name: 'Indeed Tech', url: 'https://www.indeed.com/q-Software-Engineer-jobs.html' },
    { name: 'Wellfound (AngelList)', url: 'https://wellfound.com/' },
    { name: 'Levels.fyi (Salary data)', url: 'https://www.levels.fyi/' },
    { name: 'Blind (Anonymous reviews)', url: 'https://www.teamblind.com/' },
  ],
  remote: [
    { name: 'We Work Remotely', url: 'https://weworkremotely.com/' },
    { name: 'Remote.co', url: 'https://remote.co/remote-jobs/' },
    { name: 'FlexJobs', url: 'https://www.flexjobs.com/' },
  ],
  interview: [
    { name: 'LeetCode', url: 'https://leetcode.com/' },
    { name: 'NeetCode (Curated problems)', url: 'https://neetcode.io/' },
    { name: 'Pramp (Mock interviews)', url: 'https://www.pramp.com/' },
    { name: 'Interview Query (Data)', url: 'https://www.interviewquery.com/' },
  ],
};

interface Question {
  id: string;
  question: string;
  options?: string[];
  allowCustom?: boolean;
}

interface GoalState {
  goal: string;
  type: string;
  tasks: TaskItem[];
  details: Record<string, string>;
}

type FlowStep = 'input' | 'questions' | 'tasks';

interface _AppState {
  step: FlowStep;
  goalType: string | null;
  goalText: string;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  finalGoal: GoalState | null;
}

// Detect intent from user input
function detectIntent(input: string): { type: string; extracted: Record<string, string> } | null {
  const lower = input.toLowerCase();

  if (lower.match(/\b(learn|study|course|tutorial|understand|master)\b/)) {
    const subject = extractAfter(lower, /(?:learn|study|understand|master)\s+(?:about\s+)?(?:how to\s+)?/i);
    return { type: 'learning', extracted: { subject: subject || '' } };
  }

  if (lower.match(/\b(travel|trip|visit|go to|fly to|vacation|holiday)\b/)) {
    const destination = extractAfter(lower, /(?:to|visit|travel to|go to|fly to)\s+/i);
    return { type: 'travel', extracted: { destination: destination || '' } };
  }

  if (lower.match(/\b(cook|dinner|lunch|breakfast|meal|make food|recipe|eat)\b/)) {
    const dish = extractAfter(lower, /(?:make|cook|prepare)\s+(?:a\s+)?/i);
    return { type: 'cooking', extracted: { dish: dish || '' } };
  }

  if (lower.match(/\b(party|event|birthday|celebration|wedding|gathering)\b/)) {
    const event = extractAfter(lower, /(?:plan|organize|throw|have)\s+(?:a\s+)?/i);
    return { type: 'event', extracted: { event: event || '' } };
  }

  if (lower.match(/\b(job|interview|career|resume|apply|hiring)\b/)) {
    return { type: 'job', extracted: {} };
  }

  if (lower.match(/\b(workout|exercise|gym|fitness|run|lose weight|get fit|health)\b/)) {
    return { type: 'fitness', extracted: {} };
  }

  if (lower.match(/\b(move|moving|relocate|new apartment|new house)\b/)) {
    return { type: 'moving', extracted: {} };
  }

  if (lower.match(/\b(project|build|create|start|launch|app|website)\b/)) {
    const project = extractAfter(lower, /(?:build|create|start|launch|make)\s+(?:a\s+)?/i);
    return { type: 'project', extracted: { project: project || '' } };
  }

  return null;
}

function extractAfter(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  if (match) {
    const rest = input.slice(match.index! + match[0].length).trim();
    const words = rest.split(/\s+/).slice(0, 5).join(' ');
    return words.length > 0 && words.length < 40 ? words : null;
  }
  return null;
}

// Questions for each intent type
function getQuestionsForIntent(type: string, extracted: Record<string, string>): Question[] {
  switch (type) {
    case 'learning':
      return [
        {
          id: 'level',
          question: `What's your current level with ${extracted.subject || 'this topic'}?`,
          options: ['Complete beginner', 'Know the basics', 'Intermediate', 'Advanced (want to master)'],
        },
        {
          id: 'purpose',
          question: 'What do you want to achieve?',
          options: extracted.subject?.toLowerCase().includes('python')
            ? ['Build web apps', 'Data science & ML', 'Automation & scripting', 'Game development', 'General programming']
            : extracted.subject?.toLowerCase().includes('guitar') || extracted.subject?.toLowerCase().includes('piano') || extracted.subject?.toLowerCase().includes('music')
            ? ['Play songs I like', 'Join a band', 'Write my own music', 'Professional performance', 'Just for fun']
            : ['Career/job related', 'Personal project', 'Hobby/interest', 'School/education', 'Teach others'],
        },
        {
          id: 'time',
          question: 'How much time can you dedicate per week?',
          options: ['1-2 hours', '3-5 hours', '5-10 hours', '10+ hours'],
        },
        {
          id: 'style',
          question: 'How do you prefer to learn?',
          options: ['Video courses', 'Reading/documentation', 'Hands-on projects', 'Mix of everything'],
        },
      ];

    case 'travel':
      return [
        {
          id: 'duration',
          question: `How long is your trip to ${extracted.destination || 'your destination'}?`,
          options: ['Weekend (2-3 days)', '1 week', '2 weeks', '1 month+'],
        },
        {
          id: 'purpose',
          question: 'What type of trip is this?',
          options: ['Vacation/leisure', 'Business', 'Visiting family/friends', 'Adventure/backpacking', 'Relocation'],
        },
        {
          id: 'budget',
          question: 'What\'s your budget level?',
          options: ['Budget-friendly', 'Mid-range', 'Luxury', 'No budget concerns'],
        },
        {
          id: 'visa',
          question: 'Do you need a visa?',
          options: ['Yes, need to apply', 'No, visa-free for me', 'Not sure, need to check', 'Already have one'],
        },
      ];

    case 'cooking':
      return [
        {
          id: 'people',
          question: 'How many people are you cooking for?',
          options: ['Just myself', '2 people', '3-4 people', '5+ people (gathering)'],
        },
        {
          id: 'skill',
          question: 'What\'s your cooking experience?',
          options: ['Beginner', 'Can follow recipes', 'Comfortable in kitchen', 'Experienced cook'],
        },
        {
          id: 'time',
          question: 'How much time do you have?',
          options: ['Quick (under 30 min)', 'Normal (30-60 min)', 'Have time (1-2 hours)', 'All day cooking'],
        },
        {
          id: 'dietary',
          question: 'Any dietary restrictions?',
          options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Other restrictions'],
          allowCustom: true,
        },
      ];

    case 'event':
      return [
        {
          id: 'size',
          question: 'How many guests?',
          options: ['Small (under 10)', 'Medium (10-30)', 'Large (30-50)', 'Very large (50+)'],
        },
        {
          id: 'venue',
          question: 'Where will it be held?',
          options: ['At home', 'Rented venue', 'Restaurant/bar', 'Outdoor', 'Still deciding'],
        },
        {
          id: 'timeline',
          question: 'When is the event?',
          options: ['This week', '2-4 weeks away', '1-2 months away', '3+ months away'],
        },
        {
          id: 'budget',
          question: 'What\'s your budget?',
          options: ['Keep it cheap', 'Moderate spending', 'Willing to splurge', 'No budget limit'],
        },
      ];

    case 'job':
      return [
        {
          id: 'status',
          question: 'What\'s your current situation?',
          options: ['Currently employed, looking for change', 'Unemployed, actively searching', 'Student/new grad', 'Returning to workforce'],
        },
        {
          id: 'field',
          question: 'What field/industry?',
          options: ['Tech/Software', 'Business/Finance', 'Healthcare', 'Creative/Design', 'Other'],
          allowCustom: true,
        },
        {
          id: 'urgency',
          question: 'How urgent is your search?',
          options: ['ASAP', 'Within 1-2 months', 'Within 6 months', 'Just exploring options'],
        },
        {
          id: 'materials',
          question: 'What do you have ready?',
          options: ['Nothing yet', 'Have old resume', 'Resume is updated', 'Resume + portfolio ready'],
        },
      ];

    case 'fitness':
      return [
        {
          id: 'goal',
          question: 'What\'s your main fitness goal?',
          options: ['Lose weight', 'Build muscle', 'Improve endurance', 'Get healthier overall', 'Train for event'],
        },
        {
          id: 'level',
          question: 'Current fitness level?',
          options: ['Sedentary (no exercise)', 'Light activity', 'Moderately active', 'Already fit'],
        },
        {
          id: 'equipment',
          question: 'What do you have access to?',
          options: ['Nothing (bodyweight only)', 'Basic home equipment', 'Full home gym', 'Gym membership'],
        },
        {
          id: 'time',
          question: 'How often can you workout?',
          options: ['2-3 times/week', '4-5 times/week', 'Daily', 'Varies week to week'],
        },
      ];

    case 'moving':
      return [
        {
          id: 'distance',
          question: 'How far are you moving?',
          options: ['Same city', 'Different city (same country)', 'Different country', 'Just a different apartment nearby'],
        },
        {
          id: 'timeline',
          question: 'When do you need to move?',
          options: ['Within 2 weeks', 'Within a month', '1-3 months', 'Flexible timeline'],
        },
        {
          id: 'stuff',
          question: 'How much stuff do you have?',
          options: ['Minimal (few boxes)', 'Studio/1BR worth', 'Full apartment', 'Entire house'],
        },
        {
          id: 'help',
          question: 'How will you move?',
          options: ['DIY with friends', 'Rent a truck', 'Hire movers', 'Haven\'t decided'],
        },
      ];

    case 'project':
      return [
        {
          id: 'type',
          question: 'What type of project?',
          options: ['Website/web app', 'Mobile app', 'Physical/DIY project', 'Business venture', 'Creative project'],
        },
        {
          id: 'experience',
          question: 'Your experience with this?',
          options: ['First time', 'Some experience', 'Done similar before', 'Expert level'],
        },
        {
          id: 'timeline',
          question: 'Target completion?',
          options: ['1 week', '1 month', '3 months', '6+ months', 'No deadline'],
        },
        {
          id: 'team',
          question: 'Working alone or with others?',
          options: ['Solo project', 'With 1-2 people', 'Small team', 'Large team'],
        },
      ];

    default:
      return [];
  }
}

// Helper to find destination key
function findDestinationKey(destination: string): string | null {
  const lower = destination.toLowerCase();
  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('kyoto') || lower.includes('osaka')) return 'japan';
  if (lower.includes('france') || lower.includes('paris')) return 'france';
  if (lower.includes('italy') || lower.includes('rome') || lower.includes('venice') || lower.includes('florence')) return 'italy';
  if (lower.includes('thailand') || lower.includes('bangkok') || lower.includes('phuket')) return 'thailand';
  if (lower.includes('uk') || lower.includes('england') || lower.includes('london') || lower.includes('britain')) return 'uk';
  return null;
}

// Helper to find learning resource key
function findLearningKey(subject: string): string | null {
  const lower = subject.toLowerCase();
  if (lower.includes('python')) return 'python';
  if (lower.includes('javascript') || lower.includes('js')) return 'javascript';
  return null;
}

// Generate detailed tasks based on intent and answers
function generateDetailedTasks(type: string, answers: Record<string, string>, extracted: Record<string, string>): TaskItem[] {
  const createTask = (text: string, category?: string, link?: string, linkText?: string, description?: string): TaskItem => ({
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text,
    checked: false,
    category,
    link,
    linkText,
    description,
  });

  switch (type) {
    case 'learning': {
      const subject = extracted.subject || 'the topic';
      const level = answers.level || '';
      const purpose = answers.purpose || '';
      const timePerWeek = answers.time || '';
      const style = answers.style || '';

      // Get subject-specific resources
      const learnKey = findLearningKey(subject);
      const resources = learnKey ? learningResources[learnKey] : null;

      const tasks: TaskItem[] = [];

      // Setup tasks based on level
      if (level.includes('beginner')) {
        tasks.push(createTask(`Research what ${subject} is and why it's useful`, 'research'));

        // Add specific beginner courses if available
        if (resources) {
          tasks.push(createTask('Recommended beginner courses:', 'courses'));
          resources.beginnerCourses.forEach(course => {
            tasks.push(createTask(course.name, 'courses', course.url, 'Start Course'));
          });
        } else {
          tasks.push(createTask('Find beginner-friendly learning resources', 'research', 'https://www.coursera.org/', 'Coursera'));
          tasks.push(createTask('Check YouTube tutorials', 'research', 'https://www.youtube.com/', 'YouTube'));
        }
        tasks.push(createTask('Set up your learning environment/tools', 'setup'));
      } else {
        tasks.push(createTask(`Assess your current ${subject} knowledge gaps`, 'research'));
        if (resources) {
          tasks.push(createTask('Reference documentation:', 'documentation'));
          resources.documentation.forEach(doc => {
            tasks.push(createTask(doc.name, 'documentation', doc.url, 'Read Docs'));
          });
        } else {
          tasks.push(createTask('Find intermediate/advanced resources', 'research'));
        }
      }

      // Resource tasks based on style
      if (style.includes('Video')) {
        tasks.push(createTask('Find top-rated video courses', 'resources', 'https://www.udemy.com/', 'Udemy'));
        tasks.push(createTask('Check Coursera for university courses', 'resources', 'https://www.coursera.org/', 'Coursera'));
      }
      if (style.includes('Reading') && resources) {
        tasks.push(createTask('Documentation & reading:', 'resources'));
        resources.documentation.forEach(doc => {
          tasks.push(createTask(doc.name, 'resources', doc.url, 'Read'));
        });
      }
      if (style.includes('Hands-on') || style.includes('Mix')) {
        if (resources) {
          tasks.push(createTask('Practice platforms:', 'practice'));
          resources.practice.forEach(p => {
            tasks.push(createTask(p.name, 'practice', p.url, 'Practice'));
          });
        } else {
          tasks.push(createTask('Find practice exercises', 'resources', 'https://exercism.org/', 'Exercism'));
        }
        tasks.push(createTask('Identify a starter project to build', 'resources'));
      }

      // Schedule based on time
      tasks.push(createTask(`Block ${timePerWeek} in your calendar for learning`, 'planning'));
      tasks.push(createTask('Set weekly learning goals', 'planning'));

      // Purpose-specific tasks for Python
      if (subject.toLowerCase().includes('python')) {
        tasks.push(createTask('Install Python 3.12+', 'setup', 'https://www.python.org/downloads/', 'Download Python',
          'Download the latest Python version (3.12 or newer). During installation on Windows, check "Add Python to PATH". On Mac, use Homebrew: brew install python3'));
        tasks.push(createTask('Set up VS Code with Python extension', 'setup', 'https://code.visualstudio.com/', 'Get VS Code',
          'Download VS Code, then install the "Python" extension by Microsoft. Also install "Pylance" for better code completion and "Python Debugger" for debugging.'));
        tasks.push(createTask('Learn basic syntax: variables, data types, operators', 'fundamentals', undefined, undefined,
          'Key concepts: Variables (x = 5), Data types (int, float, str, bool), Operators (+, -, *, /, //, %, **). Practice: Create variables of each type and perform operations.'));
        tasks.push(createTask('Master control flow: if/else, loops', 'fundamentals', undefined, undefined,
          'Learn: if/elif/else statements, for loops (for item in list), while loops, break/continue statements. Practice: Write a number guessing game.'));
        tasks.push(createTask('Understand functions and parameters', 'fundamentals', undefined, undefined,
          'Learn: def keyword, parameters vs arguments, return statements, *args and **kwargs, default parameters. Practice: Write a calculator function.'));
        tasks.push(createTask('Learn about lists, dictionaries, and sets', 'fundamentals', undefined, undefined,
          'Lists: ordered, mutable [1,2,3]. Dicts: key-value pairs {"name": "John"}. Sets: unique values {1,2,3}. Learn list comprehensions for elegant code.'));

        if (purpose.includes('Data science')) {
          tasks.push(createTask('Install Anaconda', 'setup', 'https://www.anaconda.com/download', 'Download Anaconda'));
          tasks.push(createTask('Learn Jupyter Notebooks', 'setup', 'https://jupyter.org/', 'Jupyter'));
          tasks.push(createTask('Learn NumPy basics', 'data science', 'https://numpy.org/doc/stable/user/quickstart.html', 'NumPy Guide'));
          tasks.push(createTask('Master Pandas for data manipulation', 'data science', 'https://pandas.pydata.org/docs/getting_started/', 'Pandas Guide'));
          tasks.push(createTask('Learn Matplotlib/Seaborn visualization', 'data science', 'https://matplotlib.org/stable/tutorials/', 'Matplotlib'));
          tasks.push(createTask('Intro to scikit-learn', 'data science', 'https://scikit-learn.org/stable/getting_started.html', 'scikit-learn'));
          tasks.push(createTask('Try Kaggle competitions', 'projects', 'https://www.kaggle.com/learn', 'Kaggle'));
        } else if (purpose.includes('web')) {
          tasks.push(createTask('Learn Flask basics', 'web dev', 'https://flask.palletsprojects.com/en/3.0.x/quickstart/', 'Flask Docs'));
          tasks.push(createTask('Or try Django', 'web dev', 'https://docs.djangoproject.com/en/5.0/intro/tutorial01/', 'Django Tutorial'));
          tasks.push(createTask('Understand HTTP and REST APIs', 'web dev'));
          tasks.push(createTask('Build a simple web application', 'projects'));
          tasks.push(createTask('Learn SQLite/PostgreSQL', 'web dev', 'https://www.sqlitetutorial.net/', 'SQLite Tutorial'));
          tasks.push(createTask('Deploy on Railway', 'projects', 'https://railway.app/', 'Railway'));
        } else if (purpose.includes('Automation')) {
          tasks.push(createTask('Read "Automate the Boring Stuff"', 'automation', 'https://automatetheboringstuff.com/', 'Free Book'));
          tasks.push(createTask('Learn file handling and OS operations', 'automation'));
          tasks.push(createTask('Master regular expressions', 'automation', 'https://regex101.com/', 'Regex101'));
          tasks.push(createTask('Learn BeautifulSoup for web scraping', 'automation', 'https://beautiful-soup-4.readthedocs.io/', 'BeautifulSoup'));
          tasks.push(createTask('Learn Selenium for browser automation', 'automation', 'https://selenium-python.readthedocs.io/', 'Selenium Docs'));
          tasks.push(createTask('Automate a repetitive task you do', 'projects'));
        }
      } else {
        // Generic learning tasks
        tasks.push(createTask(`Complete fundamentals of ${subject}`, 'fundamentals'));
        tasks.push(createTask('Practice basic concepts daily', 'practice'));
        tasks.push(createTask('Find a community or study group', 'community', 'https://www.reddit.com/', 'Reddit'));
        tasks.push(createTask('Join Discord communities', 'community', 'https://discord.com/', 'Discord'));
        tasks.push(createTask(`Build your first ${subject} project`, 'projects'));
        tasks.push(createTask('Get feedback on your progress', 'review'));
        tasks.push(createTask('Tackle intermediate concepts', 'intermediate'));
        tasks.push(createTask('Build a portfolio piece', 'projects'));
      }

      // Communities
      if (resources) {
        tasks.push(createTask('Join communities for help:', 'community'));
        resources.communities.forEach(c => {
          tasks.push(createTask(c.name, 'community', c.url, 'Join'));
        });
      }

      tasks.push(createTask('Track your progress weekly', 'habits'));
      tasks.push(createTask('Review and revise learned material', 'review'));

      return tasks;
    }

    case 'travel': {
      const destination = extracted.destination || 'your destination';
      const purpose = answers.purpose || '';
      const budget = answers.budget || '';
      const visa = answers.visa || '';

      // Get destination-specific resources
      const destKey = findDestinationKey(destination);
      const resources = destKey ? destinationResources[destKey] : null;

      const tasks: TaskItem[] = [];

      // Visa tasks
      if (visa.includes('need to apply') || visa.includes('Not sure')) {
        if (resources) {
          tasks.push(createTask(`Check visa requirements for ${destination} (${resources.visa.info})`, 'documents', resources.visa.url, 'Apply for Visa'));
        } else {
          tasks.push(createTask(`Check visa requirements for ${destination}`, 'documents'));
        }
        tasks.push(createTask('Gather visa application documents', 'documents'));
        tasks.push(createTask('Schedule visa appointment if needed', 'documents'));
        tasks.push(createTask('Submit visa application', 'documents'));
        tasks.push(createTask('Track visa status', 'documents'));
      }

      tasks.push(createTask('Check passport validity (6+ months from travel)', 'documents', undefined, undefined,
        'Most countries require your passport to be valid for at least 6 months beyond your travel dates. Check expiration date now and renew if needed - passport renewals can take 4-8 weeks.'));
      tasks.push(createTask('Make copies of important documents', 'documents', undefined, undefined,
        'Make digital copies of: passport info page, visa, flight confirmations, hotel bookings, travel insurance, credit cards (front/back). Store in cloud (Google Drive, Dropbox) and email to yourself.'));

      // Booking tasks - with links
      if (resources) {
        tasks.push(createTask(`Search flights to ${destination}`, 'booking', resources.flights[0], 'Google Flights',
          'Use Google Flights to compare airlines and prices. Enable price tracking for alerts. Flexible dates can save 20-40%. Book 2-3 months ahead for best international fares.'));
        tasks.push(createTask('Compare prices on Skyscanner', 'booking', resources.flights[1], 'Skyscanner',
          'Skyscanner searches across all booking sites. Use "Everywhere" feature to find cheapest destinations. Compare prices in incognito mode to avoid price tracking.'));
      } else {
        tasks.push(createTask(`Research best time to book flights to ${destination}`, 'booking', 'https://www.google.com/travel/flights', 'Google Flights',
          'Use Google Flights price graph to find cheapest travel dates. Enable price tracking to get alerts when prices drop. Tuesday-Wednesday flights are often cheaper.'));
        tasks.push(createTask('Compare flight prices', 'booking', 'https://www.skyscanner.com/', 'Skyscanner',
          'Search multiple sites: Google Flights, Skyscanner, Kayak. Check airline websites directly too - sometimes they have exclusive deals.'));
      }
      tasks.push(createTask('Book flights', 'booking', undefined, undefined,
        'Before booking: Verify name matches passport exactly. Add travel insurance. Check baggage allowances. Save confirmation emails. Add flights to calendar.'));

      if (resources) {
        tasks.push(createTask(`Find accommodation in ${destination}`, 'booking', resources.hotels[0], 'Search Hotels'));
        if (resources.hotels[1]) {
          tasks.push(createTask('Check Airbnb/Agoda for alternatives', 'booking', resources.hotels[1], 'View Options'));
        }
      } else if (budget.includes('Budget')) {
        tasks.push(createTask('Research budget accommodation (hostels, Airbnb)', 'booking', 'https://www.hostelworld.com/', 'Hostelworld'));
      } else if (budget.includes('Luxury')) {
        tasks.push(createTask('Research luxury hotels and resorts', 'booking', 'https://www.booking.com/', 'Booking.com'));
      } else {
        tasks.push(createTask('Compare hotels', 'booking', 'https://www.booking.com/', 'Booking.com'));
      }

      tasks.push(createTask('Get travel insurance', 'booking', 'https://www.worldnomads.com/', 'World Nomads'));

      // Attractions - with specific links
      if (resources) {
        tasks.push(createTask(`Must-see attractions in ${destination}:`, 'attractions'));
        resources.attractions.forEach(attr => {
          tasks.push(createTask(attr.name, 'attractions', attr.url, 'Plan Visit'));
        });
      } else {
        tasks.push(createTask(`Research top attractions in ${destination}`, 'planning', 'https://www.tripadvisor.com/', 'TripAdvisor'));
      }

      tasks.push(createTask('Create day-by-day itinerary', 'planning'));

      if (purpose.includes('Adventure')) {
        tasks.push(createTask('Research adventure activities and tours', 'planning', 'https://www.getyourguide.com/', 'GetYourGuide'));
        tasks.push(createTask('Book adventure experiences in advance', 'planning', 'https://www.viator.com/', 'Viator'));
      }

      // Restaurants - with specific links
      if (resources) {
        tasks.push(createTask(`Find restaurants in ${destination}:`, 'food'));
        resources.restaurants.forEach(rest => {
          tasks.push(createTask(rest.name, 'food', rest.url, 'Browse'));
        });
      } else {
        tasks.push(createTask('Research local restaurants', 'food', 'https://www.tripadvisor.com/', 'TripAdvisor'));
      }

      // Local tips
      if (resources) {
        tasks.push(createTask('Local tips:', 'tips'));
        resources.tips.forEach(tip => {
          const urlMatch = tip.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            const cleanTip = tip.replace(urlMatch[0], '').replace(': ', '').trim();
            tasks.push(createTask(cleanTip, 'tips', urlMatch[0], 'Learn More'));
          } else {
            tasks.push(createTask(tip, 'tips'));
          }
        });
      }

      // Prep tasks
      tasks.push(createTask('Download offline maps (Google Maps or Maps.me)', 'preparation', 'https://www.google.com/maps', 'Google Maps'));
      tasks.push(createTask('Notify bank of travel dates', 'preparation'));
      tasks.push(createTask('Check phone/data plan for international use', 'preparation'));
      tasks.push(createTask(`Check weather forecast for ${destination}`, 'preparation', 'https://www.weather.com/', 'Weather.com'));

      // Packing tasks
      tasks.push(createTask('Create packing list', 'packing', 'https://packpoint.com/', 'PackPoint App'));
      tasks.push(createTask('Pack weather-appropriate clothing', 'packing'));
      tasks.push(createTask('Pack toiletries and medications', 'packing'));
      tasks.push(createTask('Pack electronics and chargers', 'packing'));
      tasks.push(createTask('Pack travel documents in carry-on', 'packing'));

      // Final tasks
      tasks.push(createTask('Check in online 24 hours before flight', 'departure'));
      tasks.push(createTask('Arrange airport transportation', 'departure'));
      tasks.push(createTask('Confirm all bookings', 'departure'));

      return tasks;
    }

    case 'cooking': {
      const dish = extracted.dish || 'your meal';
      const people = answers.people || '';
      const skill = answers.skill || '';
      const time = answers.time || '';
      const dietary = answers.dietary || '';

      const tasks: TaskItem[] = [];

      // Planning
      if (skill.includes('Beginner')) {
        tasks.push(createTask('Find a simple, beginner-friendly recipe', 'planning'));
        tasks.push(createTask('Watch a video tutorial of the recipe', 'planning'));
      } else {
        tasks.push(createTask(`Find a great recipe for ${dish}`, 'planning'));
      }

      tasks.push(createTask('Read through the entire recipe first', 'planning'));

      if (people.includes('5+') || people.includes('3-4')) {
        tasks.push(createTask('Scale recipe for number of servings', 'planning'));
      }

      if (dietary !== 'None') {
        tasks.push(createTask(`Find ${dietary.toLowerCase()} substitutes if needed`, 'planning'));
      }

      // Shopping
      tasks.push(createTask('Check pantry for ingredients you have', 'shopping'));
      tasks.push(createTask('Make shopping list for missing ingredients', 'shopping'));
      tasks.push(createTask('Buy fresh ingredients', 'shopping'));

      if (time.includes('Quick')) {
        tasks.push(createTask('Pre-prep ingredients the night before', 'prep'));
      }

      // Prep
      tasks.push(createTask('Wash and dry produce', 'prep'));
      tasks.push(createTask('Chop vegetables', 'prep'));
      tasks.push(createTask('Measure out ingredients', 'prep'));
      tasks.push(createTask('Prepare any marinades or sauces', 'prep'));

      if (skill.includes('Beginner')) {
        tasks.push(createTask('Set out all tools and equipment needed', 'prep'));
      }

      // Cooking
      tasks.push(createTask('Preheat oven/stovetop as needed', 'cooking'));
      tasks.push(createTask('Follow recipe steps in order', 'cooking'));
      tasks.push(createTask('Taste and adjust seasoning', 'cooking'));
      tasks.push(createTask('Check doneness before serving', 'cooking'));

      // Serving
      if (people !== 'Just myself') {
        tasks.push(createTask('Set the table', 'serving'));
        tasks.push(createTask('Prepare serving dishes', 'serving'));
      }
      tasks.push(createTask('Plate the food nicely', 'serving'));
      tasks.push(createTask('Enjoy your meal!', 'serving'));

      return tasks;
    }

    case 'job': {
      const field = answers.field || '';
      const urgency = answers.urgency || '';
      const materials = answers.materials || '';

      const tasks: TaskItem[] = [];

      // Resume tasks
      if (materials.includes('Nothing') || materials.includes('old resume')) {
        tasks.push(createTask('Write/update your resume', 'resume'));
        tasks.push(createTask('Tailor resume to target role', 'resume'));
        tasks.push(createTask('Add quantifiable achievements', 'resume'));
        tasks.push(createTask('Get resume reviewed by someone', 'resume'));
      } else {
        tasks.push(createTask('Review and refresh your resume', 'resume'));
      }

      // Online presence
      tasks.push(createTask('Update LinkedIn profile', 'online presence'));
      tasks.push(createTask('Add a professional photo', 'online presence'));
      tasks.push(createTask('Write a compelling headline and summary', 'online presence'));

      if (field.includes('Tech') || field.includes('Creative')) {
        tasks.push(createTask('Update portfolio/GitHub profile', 'online presence'));
        tasks.push(createTask('Showcase your best projects', 'online presence'));
      }

      // Research
      tasks.push(createTask(`Research companies in ${field || 'your field'}`, 'research'));
      tasks.push(createTask('Make list of target companies', 'research'));
      tasks.push(createTask('Research salary ranges for target roles', 'research'));
      tasks.push(createTask('Identify key skills employers want', 'research'));

      // Networking
      tasks.push(createTask('Reach out to your network', 'networking'));
      tasks.push(createTask('Connect with people at target companies', 'networking'));
      tasks.push(createTask('Attend industry events or meetups', 'networking'));
      tasks.push(createTask('Ask for informational interviews', 'networking'));

      // Applications
      if (urgency.includes('ASAP')) {
        tasks.push(createTask('Apply to 5+ jobs today', 'applying'));
        tasks.push(createTask('Set daily application goal', 'applying'));
      } else {
        tasks.push(createTask('Apply to jobs that match your criteria', 'applying'));
      }
      tasks.push(createTask('Customize cover letter for each application', 'applying'));
      tasks.push(createTask('Track applications in a spreadsheet', 'applying'));
      tasks.push(createTask('Follow up on applications after 1 week', 'applying'));

      // Interview prep
      tasks.push(createTask('Research common interview questions', 'interview prep'));
      tasks.push(createTask('Prepare your "tell me about yourself" answer', 'interview prep'));
      tasks.push(createTask('Prepare STAR method stories', 'interview prep'));
      tasks.push(createTask('Practice with mock interviews', 'interview prep'));
      tasks.push(createTask('Prepare questions to ask interviewers', 'interview prep'));

      if (field.includes('Tech')) {
        tasks.push(createTask('Practice coding challenges (LeetCode, HackerRank)', 'interview prep'));
        tasks.push(createTask('Review system design concepts', 'interview prep'));
      }

      tasks.push(createTask('Prepare professional outfit', 'logistics'));
      tasks.push(createTask('Send thank you notes after interviews', 'follow-up'));

      return tasks;
    }

    case 'fitness': {
      const goal = answers.goal || '';
      const level = answers.level || '';
      const equipment = answers.equipment || '';
      const frequency = answers.time || '';

      const tasks: TaskItem[] = [];

      // Goal setting
      tasks.push(createTask('Set specific, measurable fitness goals', 'planning'));
      tasks.push(createTask('Take "before" measurements/photos', 'planning'));
      tasks.push(createTask('Set realistic timeline for goals', 'planning'));

      // Setup
      if (equipment.includes('Nothing')) {
        tasks.push(createTask('Find bodyweight workout routines', 'setup'));
        tasks.push(createTask('Clear space at home for workouts', 'setup'));
      } else if (equipment.includes('Gym')) {
        tasks.push(createTask('Get familiar with gym equipment', 'setup'));
        tasks.push(createTask('Consider a session with a trainer', 'setup'));
      }

      tasks.push(createTask('Get proper workout shoes', 'setup'));
      tasks.push(createTask('Get workout clothes', 'setup'));

      // Program
      if (goal.includes('Lose weight')) {
        tasks.push(createTask('Calculate your calorie deficit needs', 'nutrition'));
        tasks.push(createTask('Plan cardio workouts (HIIT, running, cycling)', 'program'));
        tasks.push(createTask('Add strength training to preserve muscle', 'program'));
        tasks.push(createTask('Track daily food intake', 'nutrition'));
      } else if (goal.includes('Build muscle')) {
        tasks.push(createTask('Calculate protein requirements', 'nutrition'));
        tasks.push(createTask('Create strength training program', 'program'));
        tasks.push(createTask('Plan progressive overload strategy', 'program'));
        tasks.push(createTask('Schedule rest days for recovery', 'program'));
      } else if (goal.includes('endurance')) {
        tasks.push(createTask('Start with base building phase', 'program'));
        tasks.push(createTask('Gradually increase workout duration', 'program'));
        tasks.push(createTask('Add interval training', 'program'));
      }

      tasks.push(createTask(`Schedule ${frequency} workouts in calendar`, 'planning'));

      // Nutrition
      tasks.push(createTask('Plan healthy meals for the week', 'nutrition'));
      tasks.push(createTask('Prep meals in advance', 'nutrition'));
      tasks.push(createTask('Stay hydrated (8+ glasses water)', 'nutrition'));

      if (level.includes('Sedentary')) {
        tasks.push(createTask('Start with 10-15 minute workouts', 'getting started'));
        tasks.push(createTask('Focus on building the habit first', 'getting started'));
      }

      // Tracking
      tasks.push(createTask('Download fitness tracking app', 'tracking'));
      tasks.push(createTask('Log every workout', 'tracking'));
      tasks.push(createTask('Take progress photos weekly', 'tracking'));
      tasks.push(createTask('Review progress monthly', 'tracking'));

      // First workout
      tasks.push(createTask('Complete your first workout!', 'action'));
      tasks.push(createTask('Stretch after workout', 'recovery'));
      tasks.push(createTask('Get adequate sleep (7-9 hours)', 'recovery'));

      return tasks;
    }

    case 'event': {
      const size = answers.size || '';
      const venue = answers.venue || '';
      const timeline = answers.timeline || '';
      const budget = answers.budget || '';

      const tasks: TaskItem[] = [];

      // Planning
      tasks.push(createTask('Set the date and time', 'planning'));
      tasks.push(createTask('Define event budget', 'planning'));
      tasks.push(createTask('Create guest list', 'planning'));
      tasks.push(createTask('Choose event theme (if any)', 'planning'));

      // Venue
      if (venue.includes('home')) {
        tasks.push(createTask('Deep clean your home', 'venue'));
        tasks.push(createTask('Rearrange furniture for space', 'venue'));
        tasks.push(createTask('Check if you need extra chairs/tables', 'venue'));
      } else if (venue.includes('Rented') || venue.includes('deciding')) {
        tasks.push(createTask('Research venue options', 'venue'));
        tasks.push(createTask('Visit potential venues', 'venue'));
        tasks.push(createTask('Book venue and pay deposit', 'venue'));
        tasks.push(createTask('Confirm venue details and rules', 'venue'));
      }

      // Invitations
      if (timeline.includes('week')) {
        tasks.push(createTask('Send invitations ASAP', 'invitations'));
      } else {
        tasks.push(createTask('Design and send invitations', 'invitations'));
      }
      tasks.push(createTask('Set RSVP deadline', 'invitations'));
      tasks.push(createTask('Track RSVPs', 'invitations'));
      tasks.push(createTask('Send reminders to non-responders', 'invitations'));

      // Food & Drinks
      if (size.includes('Large') || size.includes('Very large')) {
        tasks.push(createTask('Research catering options', 'food'));
        tasks.push(createTask('Get catering quotes', 'food'));
        tasks.push(createTask('Book caterer', 'food'));
      } else {
        tasks.push(createTask('Plan the menu', 'food'));
        tasks.push(createTask('Make shopping list', 'food'));
        tasks.push(createTask('Buy groceries', 'food'));
        tasks.push(createTask('Prep food in advance if possible', 'food'));
      }
      tasks.push(createTask('Plan drinks (alcoholic and non-alcoholic)', 'food'));
      tasks.push(createTask('Order cake if needed', 'food'));
      tasks.push(createTask('Get plates, cups, utensils', 'food'));

      // Decorations
      tasks.push(createTask('Plan decorations', 'decor'));
      tasks.push(createTask('Buy decorations', 'decor'));
      if (!budget.includes('cheap')) {
        tasks.push(createTask('Order balloons or flowers', 'decor'));
      }

      // Entertainment
      tasks.push(createTask('Create music playlist', 'entertainment'));
      tasks.push(createTask('Plan activities or games', 'entertainment'));
      if (size.includes('Large') || size.includes('Very large')) {
        tasks.push(createTask('Consider hiring DJ/entertainment', 'entertainment'));
      }

      // Day before
      tasks.push(createTask('Confirm final headcount', 'final prep'));
      tasks.push(createTask('Set up decorations', 'final prep'));
      tasks.push(createTask('Prepare what you can in advance', 'final prep'));
      tasks.push(createTask('Charge camera/phone for photos', 'final prep'));

      // Day of
      tasks.push(createTask('Set up venue/space', 'event day'));
      tasks.push(createTask('Set out food and drinks', 'event day'));
      tasks.push(createTask('Enjoy the event!', 'event day'));

      return tasks;
    }

    case 'moving': {
      const distance = answers.distance || '';
      const timeline = answers.timeline || '';
      const stuff = answers.stuff || '';
      const help = answers.help || '';

      const tasks: TaskItem[] = [];

      // Planning
      tasks.push(createTask('Set exact moving date', 'planning'));
      tasks.push(createTask('Create moving budget', 'planning'));
      tasks.push(createTask('Create moving timeline/checklist', 'planning'));

      // New place
      if (distance.includes('Different country')) {
        tasks.push(createTask('Research visa/work permit requirements', 'documents'));
        tasks.push(createTask('Research healthcare/insurance in new country', 'research'));
        tasks.push(createTask('Open bank account in new location', 'admin'));
      }
      tasks.push(createTask('Sign lease/close on new place', 'new home'));
      tasks.push(createTask('Get keys to new place', 'new home'));
      tasks.push(createTask('Measure rooms in new place', 'new home'));

      // Logistics
      if (help.includes('movers') || stuff.includes('house') || stuff.includes('Full apartment')) {
        tasks.push(createTask('Get quotes from moving companies', 'logistics'));
        tasks.push(createTask('Book movers', 'logistics'));
        tasks.push(createTask('Confirm moving date with company', 'logistics'));
      } else if (help.includes('truck')) {
        tasks.push(createTask('Reserve moving truck', 'logistics'));
        tasks.push(createTask('Recruit friends to help', 'logistics'));
      }

      // Declutter
      tasks.push(createTask('Go through belongings room by room', 'declutter'));
      tasks.push(createTask('Sell items you don\'t need', 'declutter'));
      tasks.push(createTask('Donate items in good condition', 'declutter'));
      tasks.push(createTask('Throw away broken/useless items', 'declutter'));

      // Packing
      tasks.push(createTask('Get packing supplies (boxes, tape, markers)', 'packing'));
      tasks.push(createTask('Start packing non-essentials early', 'packing'));
      tasks.push(createTask('Pack room by room', 'packing'));
      tasks.push(createTask('Label all boxes clearly', 'packing'));
      tasks.push(createTask('Pack an "essentials" box for first night', 'packing'));

      if (stuff.includes('house') || stuff.includes('Full apartment')) {
        tasks.push(createTask('Wrap fragile items carefully', 'packing'));
        tasks.push(createTask('Disassemble furniture', 'packing'));
        tasks.push(createTask('Take photos of electronics setup', 'packing'));
      }

      // Admin tasks
      tasks.push(createTask('Update address with post office', 'admin'));
      tasks.push(createTask('Update address with bank', 'admin'));
      tasks.push(createTask('Update driver\'s license address', 'admin'));
      tasks.push(createTask('Transfer/cancel utilities at old place', 'admin'));
      tasks.push(createTask('Set up utilities at new place', 'admin'));
      tasks.push(createTask('Update subscriptions and deliveries', 'admin'));
      tasks.push(createTask('Notify employer of address change', 'admin'));

      // Before moving
      if (timeline.includes('Within 2 weeks')) {
        tasks.push(createTask('Pack urgently!', 'packing'));
      }
      tasks.push(createTask('Clean out fridge', 'prep'));
      tasks.push(createTask('Defrost freezer', 'prep'));
      tasks.push(createTask('Confirm all details with movers/helpers', 'prep'));

      // Moving day
      tasks.push(createTask('Do final walkthrough of old place', 'moving day'));
      tasks.push(createTask('Check all rooms and closets', 'moving day'));
      tasks.push(createTask('Clean old place', 'moving day'));
      tasks.push(createTask('Return old keys', 'moving day'));
      tasks.push(createTask('Supervise loading', 'moving day'));

      // After move
      tasks.push(createTask('Unpack essentials first', 'unpacking'));
      tasks.push(createTask('Set up bed and bathroom', 'unpacking'));
      tasks.push(createTask('Unpack kitchen basics', 'unpacking'));
      tasks.push(createTask('Gradually unpack remaining boxes', 'unpacking'));
      tasks.push(createTask('Explore new neighborhood', 'settling in'));

      return tasks;
    }

    case 'project': {
      const projectType = answers.type || '';
      const experience = answers.experience || '';
      const _timeline = answers.timeline || '';
      const team = answers.team || '';

      const tasks: TaskItem[] = [];

      // Planning
      tasks.push(createTask('Define project goals and success criteria', 'planning'));
      tasks.push(createTask('Write down project requirements', 'planning'));
      tasks.push(createTask('Break project into milestones', 'planning'));
      tasks.push(createTask('Set deadlines for each milestone', 'planning'));

      if (team.includes('team') || team.includes('people')) {
        tasks.push(createTask('Assign roles and responsibilities', 'planning'));
        tasks.push(createTask('Set up team communication (Slack/Discord)', 'setup'));
        tasks.push(createTask('Schedule regular check-ins', 'planning'));
      }

      // Research
      if (experience.includes('First time')) {
        tasks.push(createTask('Research how others have done similar projects', 'research'));
        tasks.push(createTask('Find tutorials or guides', 'research'));
        tasks.push(createTask('Identify potential challenges', 'research'));
      }

      // Setup
      if (projectType.includes('Website') || projectType.includes('app')) {
        tasks.push(createTask('Choose tech stack', 'setup'));
        tasks.push(createTask('Set up development environment', 'setup'));
        tasks.push(createTask('Initialize project/repository', 'setup'));
        tasks.push(createTask('Set up version control (Git)', 'setup'));
        tasks.push(createTask('Create basic project structure', 'development'));
        tasks.push(createTask('Build core functionality first', 'development'));
        tasks.push(createTask('Add features incrementally', 'development'));
        tasks.push(createTask('Test as you build', 'development'));
        tasks.push(createTask('Get feedback from users', 'feedback'));
        tasks.push(createTask('Fix bugs and issues', 'development'));
        tasks.push(createTask('Deploy/launch', 'launch'));
      } else if (projectType.includes('Physical') || projectType.includes('DIY')) {
        tasks.push(createTask('Create design/blueprint', 'planning'));
        tasks.push(createTask('List materials needed', 'planning'));
        tasks.push(createTask('Buy materials', 'setup'));
        tasks.push(createTask('Gather tools needed', 'setup'));
        tasks.push(createTask('Start building/creating', 'execution'));
        tasks.push(createTask('Complete each section methodically', 'execution'));
        tasks.push(createTask('Test/verify as you go', 'execution'));
        tasks.push(createTask('Make adjustments as needed', 'execution'));
        tasks.push(createTask('Final assembly/finishing', 'completion'));
      } else if (projectType.includes('Business')) {
        tasks.push(createTask('Validate the business idea', 'research'));
        tasks.push(createTask('Research target market', 'research'));
        tasks.push(createTask('Analyze competition', 'research'));
        tasks.push(createTask('Create business plan', 'planning'));
        tasks.push(createTask('Determine startup costs', 'planning'));
        tasks.push(createTask('Build MVP or prototype', 'development'));
        tasks.push(createTask('Get early customer feedback', 'feedback'));
        tasks.push(createTask('Iterate based on feedback', 'development'));
        tasks.push(createTask('Plan go-to-market strategy', 'launch'));
        tasks.push(createTask('Launch!', 'launch'));
      } else {
        tasks.push(createTask('Gather materials and resources', 'setup'));
        tasks.push(createTask('Start with first milestone', 'execution'));
        tasks.push(createTask('Complete each phase', 'execution'));
        tasks.push(createTask('Review progress regularly', 'review'));
        tasks.push(createTask('Adjust plan as needed', 'review'));
        tasks.push(createTask('Complete final milestone', 'completion'));
      }

      // Wrap up
      tasks.push(createTask('Review completed project', 'review'));
      tasks.push(createTask('Document what you learned', 'review'));
      tasks.push(createTask('Celebrate completion!', 'completion'));

      return tasks;
    }

    default:
      return [];
  }
}

function getGoalTitle(type: string, answers: Record<string, string>, extracted: Record<string, string>): string {
  switch (type) {
    case 'learning':
      return `Learn ${extracted.subject || 'a new skill'}`;
    case 'travel':
      return `Travel to ${extracted.destination || 'destination'}`;
    case 'cooking':
      return `Make ${extracted.dish || 'a delicious meal'}`;
    case 'event':
      return `Plan ${extracted.event || 'an event'}`;
    case 'job':
      return `Land a ${answers.field || ''} job`.trim();
    case 'fitness':
      return answers.goal || 'Achieve fitness goals';
    case 'moving':
      return `Move to ${answers.distance?.includes('country') ? 'a new country' : 'a new place'}`;
    case 'project':
      return `Build ${extracted.project || answers.type || 'a project'}`;
    default:
      return 'Complete my goal';
  }
}

// Extended GoalState with ID for multi-goal support
interface StoredGoal extends GoalState {
  id: string;
  createdAt: number;
  status: 'planning' | 'in_progress' | 'completed';
  order?: number;
  backgroundImage?: string;
  detectedCategory?: string;
}

// Default board background images
const boardBackgrounds = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', // Mountains
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80', // Beach
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80', // Snow mountain
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80', // Japan temple
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80', // Travel map
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80', // Study desk
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80', // Coding laptop
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80', // Fitness
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80', // Cooking
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80', // Work desk
];

type ViewMode = 'home' | 'dashboard' | 'input' | 'questions' | 'tasks' | 'profile' | 'calendar' | 'ideas' | 'goal';

// Board/Workspace types
interface _Board {
  id: string;
  name: string;
  category: string;
  backgroundImage?: string;
  backgroundColor?: string;
}

// Category columns for Trello-style board
const categoryColumns = [
  { id: 'travel', title: 'Travel', emoji: '✈️' },
  { id: 'learning', title: 'Learning', emoji: '📚' },
  { id: 'fitness', title: 'Fitness', emoji: '💪' },
  { id: 'cooking', title: 'Cooking', emoji: '🍳' },
  { id: 'job', title: 'Career', emoji: '💼' },
  { id: 'event', title: 'Events', emoji: '🎉' },
  { id: 'project', title: 'Projects', emoji: '🚀' },
  { id: 'moving', title: 'Moving', emoji: '📦' },
  { id: 'other', title: 'Other', emoji: '📋' },
];

// Sortable Card Component
function SortableCard({
  goal,
  onSelect,
  onDelete,
  progress,
  isComplete
}: {
  goal: StoredGoal;
  onSelect: () => void;
  onDelete: () => void;
  progress: { completed: number; total: number };
  isComplete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#22272b] hover:bg-[#282d33] rounded-lg px-3 py-2
               transition-all shadow-sm hover:shadow-md group relative"
    >
      {/* Drag handle - only this area triggers drag */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 w-full h-6 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      />

      <div onClick={onSelect} className="cursor-pointer relative z-10">
        {/* Card Title */}
        <h3 className="text-[#b6c2cf] text-sm font-normal leading-snug">
          {goal.goal}
        </h3>

        {/* Card Footer */}
        <div className="flex items-center gap-3 mt-2 text-[#9fadbc] text-xs">
          {/* Checklist count */}
          <div className={`flex items-center gap-1 ${isComplete ? 'bg-[#1f6b44] text-white px-1.5 py-0.5 rounded' : ''}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>{progress.completed}/{progress.total}</span>
          </div>

          {/* Delete button on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 ml-auto p-1 text-[#9fadbc] hover:text-red-400
                     rounded transition-all"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Sortable Column Component
function SortableColumn({
  column,
  goals,
  onSelectGoal,
  onDeleteGoal,
  onAddCard,
  getProgress,
}: {
  column: { id: string; title: string; emoji: string };
  goals: StoredGoal[];
  onSelectGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCard: () => void;
  getProgress: (goal: StoredGoal) => { completed: number; total: number };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-[272px] flex-shrink-0 bg-[#101204] rounded-xl max-h-[calc(100vh-100px)] flex flex-col"
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-between px-3 py-2.5 cursor-grab active:cursor-grabbing"
      >
        <h2 className="font-semibold text-[#b6c2cf] text-sm">
          {column.title}
        </h2>
        <button className="p-1.5 text-[#9fadbc] hover:text-[#b6c2cf] hover:bg-[#a6c5e229] rounded transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </button>
      </div>

      {/* Cards Container */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto flex-1">
        <SortableContext items={goals.map(g => g.id)} strategy={verticalListSortingStrategy}>
          {goals.map(goal => {
            const progress = getProgress(goal);
            const isComplete = progress.completed === progress.total && progress.total > 0;
            return (
              <SortableCard
                key={goal.id}
                goal={goal}
                onSelect={() => onSelectGoal(goal.id)}
                onDelete={() => onDeleteGoal(goal.id)}
                progress={progress}
                isComplete={isComplete}
              />
            );
          })}
        </SortableContext>

        {/* Add a card button */}
        <button
          onClick={onAddCard}
          className="w-full px-2 py-1.5 rounded-lg text-[#9fadbc] hover:text-[#b6c2cf] hover:bg-[#a6c5e229]
                   transition-all text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add a card
        </button>
      </div>
    </div>
  );
}

// Sortable Task Card Component for Kanban board
function SortableTaskCard({
  task,
  onSelect,
  getContentKindLabel,
  isUpcoming,
}: {
  task: TaskItem;
  onSelect: () => void;
  getContentKindLabel: (kind: string) => string;
  isUpcoming: (date?: string) => boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    // Hide original when dragging - DragOverlay shows the visual
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1000 : 1,
    touchAction: 'none',
  };

  const colorMap: Record<string, string> = {
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    sky: 'bg-sky-500',
    lime: 'bg-lime-500',
    pink: 'bg-pink-500',
    black: 'bg-gray-700',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg px-3 py-2 shadow-sm transition-all group
        ${task.hasNewContent
          ? 'bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-[#22272b] hover:bg-[#2c323a]'
        }
        ${task.checked ? 'opacity-60' : ''}
        ${isDragging ? 'shadow-lg ring-2 ring-accent/50' : ''}`}
    >
      {/* Drag handle at top */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 w-full h-5 cursor-grab active:cursor-grabbing"
      />

      <div onClick={onSelect} className="cursor-pointer relative">
        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {task.labels.map((label, idx) => (
              <span
                key={idx}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium text-white ${colorMap[label.color] || 'bg-gray-500'}`}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${task.checked ? 'line-through' : ''}`}>{task.text}</span>
          {task.hasNewContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-black font-bold rounded animate-pulse">
              {task.upcomingContent
                ? (isUpcoming(task.upcomingContent.releaseDate) ? 'UPCOMING' : getContentKindLabel(task.upcomingContent.contentKind))
                : 'NEW'}
            </span>
          )}
          {task.showStatus === 'ongoing' && !task.hasNewContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded">
              Returning
            </span>
          )}
          {task.showStatus === 'ended' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/30 text-gray-400 rounded">
              Ended
            </span>
          )}
        </div>

        {/* Upcoming content date */}
        {task.upcomingContent && (
          <div className="text-[10px] text-amber-400 mt-0.5">
            {task.upcomingContent.title}
            {task.upcomingContent.releaseDate && (
              <> • {new Date(task.upcomingContent.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>
        )}

        {/* Checklist progress */}
        {task.checklistTotal && task.checklistTotal > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`flex items-center gap-1 text-xs ${task.checklistChecked === task.checklistTotal ? 'text-green-400' : 'text-[#9fadbc]'}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{task.checklistChecked}/{task.checklistTotal}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Droppable Column for Task Board
function DroppableTaskColumn({
  category,
  displayName,
  tasks,
  children,
}: {
  category: string;
  displayName: string;
  tasks: TaskItem[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${category}`,
    data: { category },
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] flex-shrink-0 bg-[#101204] rounded-xl flex flex-col max-h-full transition-all
        ${isOver ? 'ring-2 ring-accent/50 bg-[#1a1f26]' : ''}`}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <h3 className="text-[#b6c2cf] text-sm font-semibold">
          {displayName}
        </h3>
        <span className="text-[#9fadbc] text-xs bg-[#22272b] px-2 py-0.5 rounded">
          {tasks.length}
        </span>
      </div>

      {/* Cards container */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto flex-1 min-h-[100px]">
        {children}
      </div>
    </div>
  );
}

// Sortable wrapper for task cards with full rendering
function SortableTaskCardWrapper({
  task,
  onSelect,
  infoMatch,
}: {
  task: TaskItem;
  onSelect: () => void;
  infoMatch: { matched: boolean; info?: { label: string; value: string; expiryDate?: string }; profileMatch?: { label: string; value: string; expiry?: string }; status: 'done' | 'valid' | 'expired' | 'none' };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    // Hide original when dragging - DragOverlay shows the visual
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1000 : 1,
    touchAction: 'none',
  };

  const colorMap: Record<string, string> = {
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    sky: 'bg-sky-500',
    lime: 'bg-lime-500',
    pink: 'bg-pink-500',
    black: 'bg-gray-700',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-card="true"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onSelect();
        }
      }}
      className={`rounded-lg shadow-sm transition-all relative cursor-grab active:cursor-grabbing px-3 py-2
        ${task.hasNewContent
          ? 'bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-[#22272b] hover:bg-[#2c323a]'
        }
        ${task.checked ? 'opacity-60' : ''}
        ${isDragging ? 'shadow-lg ring-2 ring-accent/50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {task.labels.map((label, idx) => (
              <span
                key={idx}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium text-white ${colorMap[label.color] || 'bg-gray-500'}`}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${task.checked ? 'line-through' : ''}`}>{task.text}</span>
          {task.hasNewContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-black font-bold rounded animate-pulse">
              {task.upcomingContent
                ? (isUpcoming(task.upcomingContent.releaseDate) ? 'UPCOMING' : getContentKindLabel(task.upcomingContent.contentKind))
                : 'NEW'}
            </span>
          )}
          {task.showStatus === 'ongoing' && !task.hasNewContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded">
              Returning
            </span>
          )}
          {task.showStatus === 'ended' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/30 text-gray-400 rounded">
              Ended
            </span>
          )}
        </div>
        {/* Upcoming content date */}
        {task.upcomingContent && (
          <div className="text-[10px] text-amber-400 mt-0.5">
            {task.upcomingContent.title}
            {task.upcomingContent.releaseDate && (
              <> • {new Date(task.upcomingContent.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>
        )}
        {/* Checklist progress */}
        {task.checklistTotal && task.checklistTotal > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`flex items-center gap-1 text-xs ${task.checklistChecked === task.checklistTotal ? 'text-green-400' : 'text-[#9fadbc]'}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {task.checklistChecked}/{task.checklistTotal}
            </div>
          </div>
        )}
        {infoMatch.matched && (infoMatch.info || infoMatch.profileMatch) && !task.checked && (
          <div className="flex items-center gap-1.5 mt-1">
            {infoMatch.status === 'valid' && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Valid until {new Date(infoMatch.profileMatch?.expiry || infoMatch.info?.expiryDate || '').toLocaleDateString()}
              </span>
            )}
            {infoMatch.status === 'done' && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {infoMatch.profileMatch?.label || infoMatch.info?.label}: {infoMatch.profileMatch?.value || infoMatch.info?.value}
              </span>
            )}
            {infoMatch.status === 'expired' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Expired - needs renewal!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Track whether initial load from localStorage has completed
  const [hasLoaded, setHasLoaded] = useState(false);

  // Multi-goal state
  const [goals, setGoals] = useState<StoredGoal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [addingChecklistItem, setAddingChecklistItem] = useState<string | null>(null);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [_activeBoardCategory, setActiveBoardCategory] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTaskToCategory, setAddingTaskToCategory] = useState<string | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [boardBackground, setBoardBackground] = useState<string>(boardBackgrounds[0]);

  // User info state for smart task suggestions
  const [userInfo, setUserInfo] = useState<UserInfoItem[]>([]);
  const [showMyInfo, setShowMyInfo] = useState(false);
  const [newInfoLabel, setNewInfoLabel] = useState('');
  const [newInfoValue, setNewInfoValue] = useState('');
  const [newInfoExpiry, setNewInfoExpiry] = useState('');
  const [newInfoCategory, setNewInfoCategory] = useState<UserInfoItem['category']>('personal');

  // Profile data state - stores values keyed by template field ID
  const [profileData, setProfileData] = useState<Record<string, {
    value: string;
    expiryDate?: string;
    documentName?: string;
    documentData?: string;
    documentType?: string;
  }>>({});
  const [activeProfileCategory, setActiveProfileCategory] = useState<string>('travel');


  // Form state for creating new goals
  const [formState, setFormState] = useState<{
    goalType: string | null;
    goalText: string;
    questions: Question[];
    currentQuestionIndex: number;
    answers: Record<string, string>;
    extracted: Record<string, string>;
  }>({
    goalType: null,
    goalText: '',
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    extracted: {},
  });

  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);

  // Trello import state
  const [showTrelloImportModal, setShowTrelloImportModal] = useState(false);
  const [trelloImportResult, setTrelloImportResult] = useState<TrelloImportResult | null>(null);
  const [trelloImportError, setTrelloImportError] = useState<string | null>(null);
  const [pendingImportGoal, setPendingImportGoal] = useState<StoredGoal | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });

  // Workspace customization state
  const [workspaces, setWorkspaces] = useState<Workspace[]>(defaultWorkspaces);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState('#0079bf');
  const [newWorkspaceImage, setNewWorkspaceImage] = useState('');

  // Profile customization state
  const [customProfileCategories, setCustomProfileCategories] = useState<ProfileCategory[]>(defaultProfileCategories);
  const [customProfileFields, setCustomProfileFields] = useState<ProfileField[]>(profileTemplates);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📁');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldCategory, setNewFieldCategory] = useState('');
  const [newFieldHasExpiry, setNewFieldHasExpiry] = useState(false);
  const [newFieldHasDocument, setNewFieldHasDocument] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldIcon, setNewFieldIcon] = useState('📝');

  // Drag and drop state
  const [columnOrder, setColumnOrder] = useState<string[]>(categoryColumns.map(c => c.id));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // DnD sensors - lower distance for easier activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Very small distance to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Track active dragged task for DragOverlay
  const [activeTaskDragId, setActiveTaskDragId] = useState<string | null>(null);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  // Handle drag over (for moving cards between columns)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dragging a card
    const activeGoal = goals.find(g => g.id === activeId);
    if (!activeGoal) return;

    // Find the target column
    const overColumn = columnOrder.find(col => col === overId);
    const overGoal = goals.find(g => g.id === overId);

    let targetCategory: string | undefined;
    if (overColumn) {
      targetCategory = overColumn;
    } else if (overGoal) {
      targetCategory = overGoal.detectedCategory;
    }

    if (targetCategory && activeGoal.detectedCategory !== targetCategory) {
      setGoals(prev => prev.map(g =>
        g.id === activeId ? { ...g, detectedCategory: targetCategory } : g
      ));
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging columns
    if (columnOrder.includes(activeId) && columnOrder.includes(overId)) {
      if (activeId !== overId) {
        setColumnOrder(prev => {
          const oldIndex = prev.indexOf(activeId);
          const newIndex = prev.indexOf(overId);
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
      return;
    }

    // Handle card reordering within same column
    const activeGoal = goals.find(g => g.id === activeId);
    const overGoal = goals.find(g => g.id === overId);

    if (activeGoal && overGoal && activeGoal.detectedCategory === overGoal.detectedCategory) {
      setGoals(prev => {
        const categoryGoals = prev.filter(g => g.detectedCategory === activeGoal.detectedCategory);
        const otherGoals = prev.filter(g => g.detectedCategory !== activeGoal.detectedCategory);

        const oldIndex = categoryGoals.findIndex(g => g.id === activeId);
        const newIndex = categoryGoals.findIndex(g => g.id === overId);

        const reordered = arrayMove(categoryGoals, oldIndex, newIndex);
        return [...otherGoals, ...reordered];
      });
    }
  };

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('smart_task_hub_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.goals && Array.isArray(parsed.goals)) {
          setGoals(parsed.goals);
        }
        if (parsed.userInfo && Array.isArray(parsed.userInfo)) {
          setUserInfo(parsed.userInfo);
        }
        if (parsed.profileData && typeof parsed.profileData === 'object') {
          setProfileData(parsed.profileData);
        }
        if (parsed.workspaces && Array.isArray(parsed.workspaces)) {
          setWorkspaces(parsed.workspaces);
        }
        if (parsed.customProfileCategories && Array.isArray(parsed.customProfileCategories)) {
          setCustomProfileCategories(parsed.customProfileCategories);
        }
        if (parsed.customProfileFields && Array.isArray(parsed.customProfileFields)) {
          setCustomProfileFields(parsed.customProfileFields);
        }
        if (parsed.calendarEvents && Array.isArray(parsed.calendarEvents)) {
          // Restore Date objects from strings
          const events = parsed.calendarEvents.map((e: CalendarEvent & { startDate: string; endDate: string }) => ({
            ...e,
            startDate: new Date(e.startDate),
            endDate: new Date(e.endDate),
          }));
          setCalendarEvents(events);
        }
      } catch (e) {
        // ignore
      }
    }
    setHasLoaded(true);
  }, []);

  // Save data when it changes (only after initial load to prevent overwriting)
  useEffect(() => {
    if (!hasLoaded) return;
    localStorage.setItem('smart_task_hub_v3', JSON.stringify({
      goals,
      userInfo,
      profileData,
      workspaces,
      customProfileCategories,
      customProfileFields,
      calendarEvents,
    }));
  }, [hasLoaded, goals, userInfo, profileData, workspaces, customProfileCategories, customProfileFields, calendarEvents]);

  // Real-time sync between tabs - listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only react to changes in our app's data from OTHER tabs
      if (e.key !== 'smart_task_hub_v3' || !e.newValue) return;

      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.goals && Array.isArray(parsed.goals)) {
          setGoals(parsed.goals);
        }
        if (parsed.userInfo && Array.isArray(parsed.userInfo)) {
          setUserInfo(parsed.userInfo);
        }
        if (parsed.profileData && typeof parsed.profileData === 'object') {
          setProfileData(parsed.profileData);
        }
        if (parsed.workspaces && Array.isArray(parsed.workspaces)) {
          setWorkspaces(parsed.workspaces);
        }
        if (parsed.customProfileCategories && Array.isArray(parsed.customProfileCategories)) {
          setCustomProfileCategories(parsed.customProfileCategories);
        }
        if (parsed.customProfileFields && Array.isArray(parsed.customProfileFields)) {
          setCustomProfileFields(parsed.customProfileFields);
        }
        if (parsed.calendarEvents && Array.isArray(parsed.calendarEvents)) {
          const events = parsed.calendarEvents.map((ev: CalendarEvent & { startDate: string; endDate: string }) => ({
            ...ev,
            startDate: new Date(ev.startDate),
            endDate: new Date(ev.endDate),
          }));
          setCalendarEvents(events);
        }
      } catch (err) {
        console.error('Error syncing from other tab:', err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Function to check if a task matches user info or profile data
  const getTaskInfoMatch = (task: TaskItem): { matched: boolean; info?: UserInfoItem; profileMatch?: { label: string; value: string; expiry?: string }; status: 'done' | 'valid' | 'expired' | 'none' } => {
    const taskTextLower = task.text.toLowerCase();

    // Profile template to task keyword mapping
    const profileMatchers: Record<string, string[]> = {
      passport_number: ['passport', 'renew passport', 'check passport', 'passport validity'],
      visa_us: ['us visa', 'american visa', 'visa usa'],
      visa_schengen: ['schengen visa', 'european visa', 'eu visa'],
      travel_insurance: ['travel insurance', 'insurance'],
      drivers_license: ["driver's license", 'drivers license', 'driving license'],
      python_installed: ['install python', 'python setup', 'download python'],
      node_installed: ['install node', 'node setup', 'npm'],
      vscode_installed: ['install vs code', 'vscode', 'visual studio code', 'code editor'],
      git_installed: ['install git', 'git setup'],
      health_insurance: ['health insurance', 'medical insurance'],
    };

    // Check profile data first
    for (const [fieldId, keywords] of Object.entries(profileMatchers)) {
      const keywordMatch = keywords.some(kw => taskTextLower.includes(kw.toLowerCase()));
      if (keywordMatch && profileData[fieldId]?.value) {
        const data = profileData[fieldId];
        const template = profileTemplates.find(t => t.id === fieldId);

        if (data.expiryDate) {
          const expiry = new Date(data.expiryDate);
          const today = new Date();
          const sixMonthsFromNow = new Date();
          sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

          if (expiry < today) {
            return { matched: true, profileMatch: { label: template?.label || fieldId, value: data.value, expiry: data.expiryDate }, status: 'expired' };
          } else if (expiry > sixMonthsFromNow) {
            return { matched: true, profileMatch: { label: template?.label || fieldId, value: data.value, expiry: data.expiryDate }, status: 'valid' };
          }
        }
        return { matched: true, profileMatch: { label: template?.label || fieldId, value: data.value }, status: 'done' };
      }
    }

    // Fall back to legacy user info check
    for (const [, matcher] of Object.entries(taskInfoMatchers)) {
      const keywordMatch = matcher.keywords.some(kw => taskTextLower.includes(kw.toLowerCase()));
      if (keywordMatch) {
        const matchedInfo = userInfo.find(info =>
          matcher.infoLabels.some(label =>
            info.label.toLowerCase().includes(label.toLowerCase())
          )
        );

        if (matchedInfo) {
          if (matchedInfo.expiryDate) {
            const expiry = new Date(matchedInfo.expiryDate);
            const today = new Date();
            const sixMonthsFromNow = new Date();
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

            if (expiry < today) {
              return { matched: true, info: matchedInfo, status: 'expired' };
            } else if (expiry > sixMonthsFromNow) {
              return { matched: true, info: matchedInfo, status: 'valid' };
            }
          }
          return { matched: true, info: matchedInfo, status: 'done' };
        }
      }
    }
    return { matched: false, status: 'none' };
  };

  // Add user info
  const handleAddUserInfo = () => {
    if (!newInfoLabel.trim() || !newInfoValue.trim()) return;

    const newInfo: UserInfoItem = {
      id: `info-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: newInfoCategory,
      label: newInfoLabel.trim(),
      value: newInfoValue.trim(),
      expiryDate: newInfoExpiry || undefined,
      dateAdded: Date.now(),
    };

    setUserInfo(prev => [...prev, newInfo]);
    setNewInfoLabel('');
    setNewInfoValue('');
    setNewInfoExpiry('');
  };

  // Delete user info
  const handleDeleteUserInfo = (id: string) => {
    setUserInfo(prev => prev.filter(info => info.id !== id));
  };

  // Update profile field value
  const handleUpdateProfileField = (fieldId: string, value: string, expiryDate?: string) => {
    setProfileData(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        value,
        expiryDate,
      }
    }));
  };

  // Handle document upload for profile field
  const handleProfileDocumentUpload = (fieldId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setProfileData(prev => ({
        ...prev,
        [fieldId]: {
          ...prev[fieldId],
          documentName: file.name,
          documentData: base64,
          documentType: file.type,
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  // Remove document from profile field
  const handleRemoveProfileDocument = (fieldId: string) => {
    setProfileData(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        documentName: undefined,
        documentData: undefined,
        documentType: undefined,
      }
    }));
  };

  // Get profile completion percentage
  const getProfileCompletion = () => {
    const filledFields = customProfileFields.filter(t => profileData[t.id]?.value).length;
    return Math.round((filledFields / customProfileFields.length) * 100);
  };

  // Workspace handlers
  const handleAddWorkspace = () => {
    if (!newWorkspaceName.trim()) return;
    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: newWorkspaceName.trim(),
      color: newWorkspaceColor,
      backgroundImage: newWorkspaceImage || undefined,
    };
    setWorkspaces(prev => [...prev, newWorkspace]);
    setNewWorkspaceName('');
    setNewWorkspaceColor('#0079bf');
    setNewWorkspaceImage('');
    setShowWorkspaceModal(false);
  };

  const handleUpdateWorkspace = () => {
    if (!editingWorkspace || !newWorkspaceName.trim()) return;
    setWorkspaces(prev => prev.map(w =>
      w.id === editingWorkspace.id
        ? { ...w, name: newWorkspaceName.trim(), color: newWorkspaceColor, backgroundImage: newWorkspaceImage || undefined }
        : w
    ));
    setEditingWorkspace(null);
    setNewWorkspaceName('');
    setNewWorkspaceColor('#0079bf');
    setNewWorkspaceImage('');
    setShowWorkspaceModal(false);
  };

  const handleDeleteWorkspace = (id: string) => {
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  };

  const openEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setNewWorkspaceName(workspace.name);
    setNewWorkspaceColor(workspace.color);
    setNewWorkspaceImage(workspace.backgroundImage || '');
    setShowWorkspaceModal(true);
  };

  // Profile category handlers
  const handleAddProfileCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: ProfileCategory = {
      id: `category-${Date.now()}`,
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
    };
    setCustomProfileCategories(prev => [...prev, newCategory]);
    setNewCategoryName('');
    setNewCategoryIcon('📁');
    setShowAddCategoryModal(false);
  };

  const handleDeleteProfileCategory = (id: string) => {
    setCustomProfileCategories(prev => prev.filter(c => c.id !== id));
    // Also remove fields in this category
    setCustomProfileFields(prev => prev.filter(f => f.category !== id));
  };

  // Profile field handlers
  const handleAddProfileField = () => {
    if (!newFieldLabel.trim() || !newFieldCategory) return;
    const newField: ProfileField = {
      id: `field-${Date.now()}`,
      label: newFieldLabel.trim(),
      category: newFieldCategory,
      hasExpiry: newFieldHasExpiry,
      hasDocument: newFieldHasDocument,
      placeholder: newFieldPlaceholder || `Enter ${newFieldLabel.toLowerCase()}`,
      icon: newFieldIcon,
    };
    setCustomProfileFields(prev => [...prev, newField]);
    setNewFieldLabel('');
    setNewFieldCategory('');
    setNewFieldHasExpiry(false);
    setNewFieldHasDocument(false);
    setNewFieldPlaceholder('');
    setNewFieldIcon('📝');
    setShowAddFieldModal(false);
  };

  const handleDeleteProfileField = (id: string) => {
    setCustomProfileFields(prev => prev.filter(f => f.id !== id));
    // Also remove the data for this field
    setProfileData(prev => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
  };

  // Calendar handlers
  const handleImportICS = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const events = parseICS(content, file.name);
        setCalendarEvents(prev => [...prev, ...events]);
      }
    };
    reader.readAsText(file);
  };

  const handleAddCalendarEvent = () => {
    if (!newEventTitle.trim() || !newEventDate) return;

    const startDate = newEventIsAllDay
      ? new Date(newEventDate)
      : new Date(`${newEventDate}T${newEventTime || '00:00'}`);

    const endDate = newEventIsAllDay
      ? new Date(newEventEndDate || newEventDate)
      : new Date(`${newEventEndDate || newEventDate}T${newEventEndTime || newEventTime || '00:00'}`);

    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: newEventTitle.trim(),
      startDate,
      endDate,
      location: newEventLocation || undefined,
      isAllDay: newEventIsAllDay,
      source: 'manual',
    };

    setCalendarEvents(prev => [...prev, newEvent]);
    setShowAddEventModal(false);
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventEndDate('');
    setNewEventTime('');
    setNewEventEndTime('');
    setNewEventLocation('');
    setNewEventIsAllDay(false);
  };

  const handleDeleteCalendarEvent = (id: string) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      return checkDate >= eventStart && checkDate <= eventEnd;
    });
  };

  // Get calendar month data
  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekDay = firstDay.getDay();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month's days
    const prevMonthDays = startWeekDay;
    const prevMonth = new Date(year, month, 0);
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month's days to fill the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  // Helper to format category/list names (snake_case to Title Case)
  const formatCategoryName = (category: string): string => {
    if (!category) return 'Tasks';
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper to extract URLs from text (description, comments, etc.)
  const extractUrlsFromText = (text: string): Array<{ url: string; text?: string }> => {
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
      // Check if this URL wasn't already captured as a markdown link
      if (!links.some(l => l.url === urlMatch)) {
        // Try to extract domain as text
        try {
          const domain = new URL(urlMatch).hostname.replace('www.', '');
          links.push({ url: urlMatch, text: domain });
        } catch {
          links.push({ url: urlMatch });
        }
      }
    }

    return links;
  };

  // Helper to render description text with clickable links
  const renderDescriptionWithLinks = (text: string, taskTitle?: string): React.ReactNode => {
    if (!text) return null;

    // Pattern to match markdown links [text](url "title") or [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    // Pattern to match plain URLs
    const plainUrlRegex = /(?<!\]\()https?:\/\/[^\s\])<>"]+/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // First, find all markdown links and plain URLs with their positions
    const allMatches: Array<{ start: number; end: number; url: string; text: string; type: 'markdown' | 'plain' }> = [];

    // Find markdown links
    let match: RegExpExecArray | null;
    while ((match = markdownLinkRegex.exec(text)) !== null) {
      let linkText = match[1];
      const linkUrl = match[2].split(' ')[0].replace(/"/g, ''); // Clean URL

      // If the link text is itself a URL, use task title or domain name
      if (linkText.match(/^https?:\/\//)) {
        if (taskTitle) {
          linkText = taskTitle;
        } else {
          try {
            linkText = new URL(linkText).hostname.replace('www.', '');
          } catch { /* keep original text */ }
        }
      }

      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: linkText,
        url: linkUrl,
        type: 'markdown'
      });
    }

    // Find plain URLs (not inside markdown)
    while ((match = plainUrlRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchUrl = match[0];
      // Check if this URL is inside a markdown link
      const isInsideMarkdown = allMatches.some(m =>
        m.type === 'markdown' && matchIndex >= m.start && matchIndex < m.end
      );
      if (!isInsideMarkdown) {
        // Use task title for plain URLs, or fall back to domain
        let displayText = taskTitle;
        if (!displayText) {
          try {
            displayText = new URL(matchUrl).hostname.replace('www.', '');
          } catch { displayText = matchUrl; }
        }
        allMatches.push({
          start: matchIndex,
          end: matchIndex + matchUrl.length,
          text: displayText,
          url: matchUrl,
          type: 'plain'
        });
      }
    }

    // Sort by position
    allMatches.sort((a, b) => a.start - b.start);

    // Build the rendered output
    for (const m of allMatches) {
      // Add text before this match
      if (m.start > lastIndex) {
        parts.push(<span key={key++}>{text.slice(lastIndex, m.start)}</span>);
      }
      // Add the link
      parts.push(
        <a
          key={key++}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-light underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {m.text}
        </a>
      );
      lastIndex = m.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  };

  // Trello import handler
  const handleTrelloImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Show importing screen immediately
        setIsImporting(true);
        setImportProgress({ current: 0, total: 0, status: 'Parsing Trello data...' });
        const content = e.target?.result as string;
        const data = JSON.parse(content) as TrelloBoard;

        if (!data.lists || !data.cards) {
          setTrelloImportError('Invalid Trello export file. Please export your board as JSON from Trello.');
          setShowTrelloImportModal(true);
          return;
        }

        // Get open lists only, sorted by position
        const openLists = data.lists.filter(l => !l.closed).sort((a, b) => a.pos - b.pos);

        // Create tasks from cards - each card becomes a task, list name becomes category
        const tasks: TaskItem[] = [];

        // Create a list ID to name mapping
        const listMap = new Map<string, string>();
        openLists.forEach(list => listMap.set(list.id, list.name));

        // Create checklist ID to checklist mapping
        const checklistMap = new Map<string, TrelloChecklist>();
        (data.checklists || []).forEach(cl => checklistMap.set(cl.id, cl));

        // Also create a card ID to checklists mapping (fallback for when idChecklists is empty)
        const checklistsByCard = new Map<string, TrelloChecklist[]>();
        (data.checklists || []).forEach(cl => {
          const existing = checklistsByCard.get(cl.idCard) || [];
          existing.push(cl);
          checklistsByCard.set(cl.idCard, existing);
        });

        // Create member ID to name mapping
        const memberMap = new Map<string, string>();
        (data.members || []).forEach(m => memberMap.set(m.id, m.fullName || m.username));

        // Get comments grouped by card ID
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

        // Process cards as tasks, sorted by position within each list
        const sortedCards = data.cards
          .filter(c => !c.closed)
          .sort((a, b) => a.pos - b.pos);

        sortedCards.forEach(card => {
          const listName = listMap.get(card.idList) || 'imported';
          const categoryKey = listName.toLowerCase().replace(/\s+/g, '_');

          // Convert Trello labels to task labels
          const taskLabels: TaskLabel[] = (card.labels || []).map(label => ({
            name: label.name || label.color,
            color: label.color,
          }));

          // Get full checklists for this card
          // Try via card.idChecklists first, then fallback to checklistsByCard mapping
          let rawChecklists: TrelloChecklist[] = [];

          if (card.idChecklists && card.idChecklists.length > 0) {
            rawChecklists = card.idChecklists
              .map(clId => checklistMap.get(clId))
              .filter((cl): cl is TrelloChecklist => cl !== undefined);
          } else {
            // Fallback: find checklists by card ID
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

          // Calculate checklist totals
          const checklistTotal = cardChecklists.reduce((sum, cl) => sum + cl.items.length, 0);
          const checklistChecked = cardChecklists.reduce(
            (sum, cl) => sum + cl.items.filter(i => i.checked).length,
            0
          );

          // Get attachments and identify link vs uploaded attachments
          const attachments: Attachment[] = (card.attachments || []).map(att => ({
            id: att.id,
            name: att.name,
            url: att.url,
            type: att.mimeType,
            isUpload: att.isUpload,
          }));

          // Get comments for this card
          const comments = commentsByCard.get(card.id) || [];

          // Get assigned members
          const assignees = (card.idMembers || [])
            .map(mId => memberMap.get(mId))
            .filter((name): name is string => name !== undefined);

          // Get cover info
          let coverColor: string | undefined;
          let coverImage: string | undefined;
          if (card.cover) {
            coverColor = card.cover.color;
            if (card.cover.idAttachment) {
              const coverAtt = (card.attachments || []).find(a => a.id === card.cover?.idAttachment);
              coverImage = coverAtt?.url;
            }
          }

          // Extract all links from various sources
          const extractedLinks: ExtractedLink[] = [];
          const cardTitle = card.name;

          // 1. Links from card name
          const nameLinks = extractUrlsFromText(card.name);
          nameLinks.forEach(l => extractedLinks.push({ ...l, source: 'name', cardTitle }));

          // 2. Links from description
          if (card.desc) {
            const descLinks = extractUrlsFromText(card.desc);
            descLinks.forEach(l => extractedLinks.push({ ...l, source: 'description', cardTitle }));
          }

          // 3. Link attachments (not uploaded files)
          (card.attachments || [])
            .filter(att => !att.isUpload)
            .forEach(att => {
              // Don't duplicate if already extracted
              if (!extractedLinks.some(l => l.url === att.url)) {
                extractedLinks.push({
                  url: att.url,
                  text: att.name,
                  source: 'attachment',
                  cardTitle,
                });
              }
            });

          // 4. Links from comments
          comments.forEach(comment => {
            const commentLinks = extractUrlsFromText(comment.text);
            commentLinks.forEach(l => {
              if (!extractedLinks.some(el => el.url === l.url)) {
                extractedLinks.push({ ...l, source: 'comment', cardTitle });
              }
            });
          });

          // 5. Links from checklist items
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

          // Auto-mark as done if all checklist items are complete
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
            coverImage,
            position: card.pos,
            links: extractedLinks.length > 0 ? extractedLinks : undefined,
          });
        });

        // Enrich tasks with TMDb data for TV series/media cards
        // Helper to extract year from title like "Show Name (2019- )"
        const extractYear = (title: string): string | undefined => {
          const match = title.match(/\((\d{4})/);
          return match ? match[1] : undefined;
        };

        // Helper to clean title
        const cleanTitle = (title: string): string => {
          return title.replace(/\s*\(\d{4}[^)]*\)\s*$/, '').trim();
        };

        // Helper to count seasons in checklists
        const countSeasonsInChecklists = (checklists: Checklist[]): number => {
          let maxSeason = 0;
          for (const checklist of checklists) {
            if (checklist.name.toLowerCase().includes('season') ||
                checklist.items.some(item => /season\s*\d+/i.test(item.text))) {
              for (const item of checklist.items) {
                const match = item.text.match(/season\s*(\d+)/i);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxSeason) maxSeason = num;
                }
              }
            }
          }
          return maxSeason;
        };

        // Detect content type for each task before enrichment
        setImportProgress({ current: 0, total: tasks.length, status: 'Detecting content types...' });
        const agentOrchestrator = getOrchestrator();

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          try {
            const detection = await agentOrchestrator.detect({
              title: task.text,
              description: task.description,
              listContext: task.category,
              urls: task.links?.map(l => l.url),
              checklistNames: task.checklists?.map(cl => cl.name),
            });

            if (detection.type !== 'unknown' && detection.confidence >= 25) {
              task.contentType = detection.type;
              task.contentTypeConfidence = detection.confidence;
            }
          } catch (error) {
            console.error(`Error detecting content type for task ${task.id}:`, error);
          }

          // Update progress every 5 tasks
          if (i % 5 === 0) {
            setImportProgress({ current: i + 1, total: tasks.length, status: 'Detecting content types...' });
          }
        }

        // Find tasks that need enrichment (have a detected content type)
        const scannableTypes: ContentType[] = ['tv_series', 'anime', 'movie', 'book', 'game'];
        const tasksToEnrich = tasks.filter(task => {
          // Must have a recognized content type
          if (!task.contentType || !scannableTypes.includes(task.contentType)) {
            return false;
          }
          // For TV/anime, must have checklists with season items
          if (task.contentType === 'tv_series' || task.contentType === 'anime') {
            if (!task.checklists || task.checklists.length === 0) return false;
            return countSeasonsInChecklists(task.checklists) > 0;
          }
          // For movies, books, games - always enrich
          return true;
        });

        setImportProgress({ current: 0, total: tasksToEnrich.length, status: 'Fetching content data...' });

        const newContentOrchestrator = getNewContentOrchestrator();

        // Helper to convert checklists to detection format
        const toChecklistInfo = (checklists?: Checklist[]): ChecklistInfo[] => {
          if (!checklists) return [];
          return checklists.map(cl => ({
            name: cl.name,
            items: cl.items.map(item => ({ text: item.text, checked: item.checked })),
          }));
        };

        // Enrich each task with appropriate API data
        for (let i = 0; i < tasksToEnrich.length; i++) {
          const task = tasksToEnrich[i];
          setImportProgress({
            current: i + 1,
            total: tasksToEnrich.length,
            status: `Loading: ${cleanTitle(task.text).substring(0, 30)}...`
          });

          try {
            const title = cleanTitle(task.text);
            const year = extractYear(task.text);

            // Use AgentOrchestrator to enrich based on content type
            const enrichedData = await agentOrchestrator.enrich(title, task.contentType!, year);

            if (enrichedData) {
              // Cache the enrichment data
              task.cachedEnrichment = {
                data: enrichedData,
                fetchedAt: new Date().toISOString(),
              };

              // Use NewContentOrchestrator to detect new content
              const detectionResult = newContentOrchestrator.detect({
                taskId: task.id,
                title,
                contentType: task.contentType!,
                enrichedData,
                checklists: toChecklistInfo(task.checklists),
              });

              // Update task with detection results
              task.hasNewContent = detectionResult.hasNewContent;
              task.showStatus = detectionResult.status;
              if (detectionResult.upcomingContent) {
                task.upcomingContent = detectionResult.upcomingContent;
              }
            }

            // Small delay to not overwhelm API
            if (i < tasksToEnrich.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (error) {
            console.error(`Error enriching task ${task.id}:`, error);
          }
        }

        setImportProgress({ current: tasksToEnrich.length, total: tasksToEnrich.length, status: 'Finalizing import...' });

        // Smart board type detection based on board name and content
        const boardNameLower = (data.name || '').toLowerCase();
        const allCardText = data.cards.map(c => c.name.toLowerCase()).join(' ');
        const allListNames = openLists.map(l => l.name.toLowerCase()).join(' ');

        // Detect if this is a media (TV/Movies/Anime) board
        const isMediaBoard =
          boardNameLower.match(/\b(tv|show|series|movie|film|anime|watch|drama|episode)\b/) ||
          allListNames.match(/\b(to watch|watching|watched|backlog|queue|completed|finished|dropped)\b/) ||
          allCardText.match(/\b(season|episode|s\d+e\d+|ep\s*\d+)\b/);

        // Detect specific board types
        let goalType = 'media'; // Default for imported boards
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

        // For media boards, normalize common category names
        if (detectedBoardType === 'media' || detectedBoardType === 'tvshows' ||
            detectedBoardType === 'movies' || detectedBoardType === 'anime' ||
            detectedBoardType === 'books' || detectedBoardType === 'games') {
          // Map common list names to standardized categories
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

          // Update task categories based on mapping
          tasks.forEach(task => {
            const originalCat = task.category || '';
            const normalizedCat = originalCat.toLowerCase().replace(/_/g, ' ');
            if (categoryMapping[normalizedCat]) {
              task.category = categoryMapping[normalizedCat];
            }
          });
        }

        // Get board background image if available
        let boardBackgroundImage: string | undefined;
        if (data.prefs?.backgroundImageScaled && data.prefs.backgroundImageScaled.length > 0) {
          // Get the largest available image
          const sorted = [...data.prefs.backgroundImageScaled].sort((a, b) => b.width - a.width);
          boardBackgroundImage = sorted[0].url;
        } else if (data.prefs?.backgroundImage) {
          boardBackgroundImage = data.prefs.backgroundImage;
        }

        // Calculate import stats
        const totalChecklists = tasks.reduce((sum, t) => sum + (t.checklists?.length || 0), 0);
        const totalAttachments = tasks.reduce((sum, t) => sum + (t.attachments?.length || 0), 0);
        const totalComments = tasks.reduce((sum, t) => sum + (t.comments?.length || 0), 0);
        const totalLinks = tasks.reduce((sum, t) => sum + (t.links?.length || 0), 0);

        // Create one goal for the entire board
        const newGoal: StoredGoal = {
          id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          goal: data.name || 'Imported Trello Board',
          type: goalType,
          tasks,
          details: {
            source: 'trello',
            boardUrl: data.url || '',
            listCount: openLists.length.toString(),
            boardType: detectedBoardType,
          },
          backgroundImage: boardBackgroundImage,
          createdAt: Date.now(),
          status: 'in_progress',
        };

        // Store goal as pending (only add on confirm)
        setPendingImportGoal(newGoal);

        setTrelloImportResult({
          boardName: data.name || 'Trello Board',
          goalsCreated: 1,
          tasksCreated: tasks.length,
          checklistsImported: totalChecklists,
          attachmentsImported: totalAttachments,
          commentsImported: totalComments,
          listsImported: openLists.length,
          linksExtracted: totalLinks,
        });
        setTrelloImportError(null);
        setIsImporting(false);
        setShowTrelloImportModal(true);

      } catch (err) {
        setTrelloImportError('Failed to parse Trello export file. Please make sure it\'s a valid JSON file exported from Trello.');
        setTrelloImportResult(null);
        setIsImporting(false);
        setShowTrelloImportModal(true);
      }
    };
    reader.readAsText(file);
  };

  const activeGoal = goals.find(g => g.id === activeGoalId);
  const activeTaskDrag = activeGoal?.tasks.find(t => t.id === activeTaskDragId);

  // Memoize grouped and sorted tasks to prevent re-sorting on every render
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskItem[]> = {};
    activeGoal?.tasks.forEach((task, index) => {
      const cat = task.category || 'tasks';
      if (!groups[cat]) groups[cat] = [];
      // Add original index for stable sorting
      groups[cat].push({ ...task, _originalIndex: index } as TaskItem & { _originalIndex: number });
    });

    // Sort tasks: hasNewContent cards first, then by position, then by original index (stable)
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        const aExt = a as TaskItem & { _originalIndex: number };
        const bExt = b as TaskItem & { _originalIndex: number };
        // hasNewContent cards come first
        if (a.hasNewContent && !b.hasNewContent) return -1;
        if (!a.hasNewContent && b.hasNewContent) return 1;
        // Then by position
        const posDiff = (a.position || 0) - (b.position || 0);
        if (posDiff !== 0) return posDiff;
        // Finally by original index for stability
        return aExt._originalIndex - bExt._originalIndex;
      });
    });

    return groups;
  }, [activeGoal?.tasks]);

  // Click-and-drag horizontal scroll for board
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingScroll = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start scroll if clicking on a draggable card
    const target = e.target as HTMLElement;
    if (target.closest('[data-task-card]')) {
      return;
    }
    const el = boardScrollRef.current;
    if (!el) return;
    isDraggingScroll.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
  }, []);

  const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingScroll.current) return;
    e.preventDefault();
    const el = boardScrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
    el.scrollLeft = scrollLeft.current - walk;
  }, []);

  const handleBoardMouseUp = useCallback(() => {
    isDraggingScroll.current = false;
    const el = boardScrollRef.current;
    if (el) el.style.cursor = 'grab';
  }, []);

  const handleBoardMouseLeave = useCallback(() => {
    isDraggingScroll.current = false;
    const el = boardScrollRef.current;
    if (el) el.style.cursor = 'grab';
  }, []);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const result = detectIntent(inputValue);
    if (result) {
      const questions = getQuestionsForIntent(result.type, result.extracted);
      setFormState({
        goalType: result.type,
        goalText: inputValue,
        questions,
        currentQuestionIndex: 0,
        answers: {},
        extracted: result.extracted,
      });
      setViewMode('questions');
      setInputValue('');
      setError('');
    } else {
      setError("I couldn't understand that. Try something like:\n• \"I want to learn Python\"\n• \"I want to travel to Japan\"\n• \"I want to make dinner\"");
    }
  };

  const handleAnswerSelect = (answer: string) => {
    const currentQuestion = formState.questions[formState.currentQuestionIndex];
    const newAnswers = { ...formState.answers, [currentQuestion.id]: answer };

    if (formState.currentQuestionIndex < formState.questions.length - 1) {
      setFormState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        answers: newAnswers,
      }));
    } else {
      // All questions answered, generate tasks and create goal
      const tasks = generateDetailedTasks(formState.goalType!, newAnswers, formState.extracted);
      const goalTitle = getGoalTitle(formState.goalType!, newAnswers, formState.extracted);

      // Get type-specific background or random one
      const typeBackgrounds: Record<string, string> = {
        travel: boardBackgrounds[4],
        learning: boardBackgrounds[5],
        fitness: boardBackgrounds[7],
        cooking: boardBackgrounds[8],
        job: boardBackgrounds[9],
        project: boardBackgrounds[6],
      };
      const bgImage = selectedBackground || typeBackgrounds[formState.goalType!] || boardBackgrounds[Math.floor(Math.random() * boardBackgrounds.length)];

      const newGoal: StoredGoal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        goal: goalTitle,
        type: formState.goalType!,
        tasks,
        details: newAnswers,
        createdAt: Date.now(),
        status: 'planning',
        backgroundImage: bgImage,
      };

      setGoals(prev => [...prev, newGoal]);
      setActiveGoalId(newGoal.id);
      setSelectedBackground(null);
      setViewMode('tasks');

      // Reset form state
      setFormState({
        goalType: null,
        goalText: '',
        questions: [],
        currentQuestionIndex: 0,
        answers: {},
        extracted: {},
      });
    }
  };

  const handleToggleTask = (taskId: string) => {
    if (!activeGoalId) return;
    setGoals(prev => prev.map(goal => {
      if (goal.id === activeGoalId) {
        return {
          ...goal,
          tasks: goal.tasks.map(task =>
            task.id === taskId ? { ...task, checked: !task.checked } : task
          ),
        };
      }
      return goal;
    }));
  };

  // Track the last category we moved to during drag (prevents duplicate updates)
  const lastDragOverCategory = useRef<string | null>(null);

  // Handle task drag over - for real-time column detection during drag
  const handleTaskDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !activeGoalId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active task
    const activeTask = activeGoal?.tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Determine target category
    let targetCategory: string | undefined = undefined;

    if (overId.startsWith('column-')) {
      targetCategory = overId.replace('column-', '');
    } else {
      // Dropping over another task - get that task's category
      const overTask = activeGoal?.tasks.find(t => t.id === overId);
      if (overTask?.category) {
        targetCategory = overTask.category;
      }
    }

    // Only update if category changed AND different from last update (prevents duplicate state updates)
    if (targetCategory &&
        activeTask.category !== targetCategory &&
        lastDragOverCategory.current !== targetCategory) {
      lastDragOverCategory.current = targetCategory;
      const newCategory = targetCategory;
      setGoals(prev => prev.map(goal => {
        if (goal.id === activeGoalId) {
          return {
            ...goal,
            tasks: goal.tasks.map(task =>
              task.id === activeId
                ? { ...task, category: newCategory }
                : task
            ),
          };
        }
        return goal;
      }));
    }
  };

  // Handle task drag end - move between columns or reorder within column
  const handleTaskDragEnd = (event: DragEndEvent) => {
    // Reset the drag over tracking
    lastDragOverCategory.current = null;

    const { active, over } = event;

    if (!over || !activeGoalId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active task
    const activeTask = activeGoal?.tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if dropping on a column
    if (overId.startsWith('column-')) {
      const targetCategory = overId.replace('column-', '');
      if (activeTask.category !== targetCategory) {
        // Move task to new column
        setGoals(prev => prev.map(goal => {
          if (goal.id === activeGoalId) {
            return {
              ...goal,
              tasks: goal.tasks.map(task =>
                task.id === activeId
                  ? { ...task, category: targetCategory, position: Date.now() }
                  : task
              ),
            };
          }
          return goal;
        }));
      }
      return;
    }

    // Check if dropping on another task
    const overTask = activeGoal?.tasks.find(t => t.id === overId);
    if (!overTask) return;

    // If same category, reorder
    if (activeTask.category === overTask.category) {
      setGoals(prev => prev.map(goal => {
        if (goal.id === activeGoalId) {
          const categoryTasks = goal.tasks.filter(t => t.category === activeTask.category);
          const otherTasks = goal.tasks.filter(t => t.category !== activeTask.category);

          const oldIndex = categoryTasks.findIndex(t => t.id === activeId);
          const newIndex = categoryTasks.findIndex(t => t.id === overId);

          const reordered = arrayMove(categoryTasks, oldIndex, newIndex);
          // Update positions based on new order
          const withPositions = reordered.map((task, idx) => ({ ...task, position: idx }));

          return { ...goal, tasks: [...otherTasks, ...withPositions] };
        }
        return goal;
      }));
    } else {
      // Move to different category at specific position
      const targetCategory = overTask.category;
      setGoals(prev => prev.map(goal => {
        if (goal.id === activeGoalId) {
          const tasksWithoutActive = goal.tasks.filter(t => t.id !== activeId);
          const targetCategoryTasks = tasksWithoutActive.filter(t => t.category === targetCategory);
          const otherTasks = tasksWithoutActive.filter(t => t.category !== targetCategory);

          const insertIndex = targetCategoryTasks.findIndex(t => t.id === overId);
          const updatedTask = { ...activeTask, category: targetCategory };

          // Insert at the correct position
          targetCategoryTasks.splice(insertIndex, 0, updatedTask);

          // Update positions
          const withPositions = targetCategoryTasks.map((task, idx) => ({ ...task, position: idx }));

          return { ...goal, tasks: [...otherTasks, ...withPositions] };
        }
        return goal;
      }));
    }
  };

  // Add a new task manually
  const handleAddTask = (text: string, category?: string) => {
    if (!activeGoalId || !text.trim()) return;
    const newTask: TaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      checked: false,
      category: category || 'custom',
    };
    setGoals(prev => prev.map(goal => {
      if (goal.id === activeGoalId) {
        return { ...goal, tasks: [...goal.tasks, newTask] };
      }
      return goal;
    }));
    setNewTaskText('');
    setAddingTaskToCategory(null);
  };

  // Edit an existing task
  const handleEditTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    if (!activeGoalId) return;
    setGoals(prev => prev.map(goal => {
      if (goal.id === activeGoalId) {
        return {
          ...goal,
          tasks: goal.tasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
          ),
        };
      }
      return goal;
    }));
  }, [activeGoalId]);

  // Background scanner for new content (seasons, etc.)
  const { scanning: contentScanning, scannedCount, totalToScan, rescan: rescanContent } = useNewContentScanner(
    activeGoal?.tasks || [],
    handleEditTask,
    !!activeGoalId && viewMode === 'tasks' // Only scan when viewing tasks
  );

  // Add item to a checklist
  const handleAddChecklistItem = (taskId: string, checklistId: string, text: string) => {
    if (!activeGoalId || !text.trim()) return;
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      checked: false,
    };
    setGoals(prev => prev.map(goal => {
      if (goal.id === activeGoalId) {
        return {
          ...goal,
          tasks: goal.tasks.map(task => {
            if (task.id === taskId && task.checklists) {
              return {
                ...task,
                checklists: task.checklists.map(cl =>
                  cl.id === checklistId
                    ? { ...cl, items: [...cl.items, newItem] }
                    : cl
                ),
                checklistTotal: (task.checklistTotal || 0) + 1,
              };
            }
            return task;
          }),
        };
      }
      return goal;
    }));
    setNewChecklistItemText('');
    setAddingChecklistItem(null);
  };

  // Toggle checklist item
  const handleToggleChecklistItem = (taskId: string, checklistId: string, itemId: string) => {
    if (!activeGoalId) return;
    setGoals(prev => prev.map(goal => {
      if (goal.id === activeGoalId) {
        return {
          ...goal,
          tasks: goal.tasks.map(task => {
            if (task.id === taskId && task.checklists) {
              let checkedDelta = 0;
              const updatedChecklists = task.checklists.map(cl => {
                if (cl.id === checklistId) {
                  return {
                    ...cl,
                    items: cl.items.map(item => {
                      if (item.id === itemId) {
                        checkedDelta = item.checked ? -1 : 1;
                        return { ...item, checked: !item.checked };
                      }
                      return item;
                    }),
                  };
                }
                return cl;
              });
              const newChecklistChecked = (task.checklistChecked || 0) + checkedDelta;
              const isFullyComplete = task.checklistTotal && newChecklistChecked === task.checklistTotal;
              return {
                ...task,
                checklists: updatedChecklists,
                checklistChecked: newChecklistChecked,
                // Auto-mark card as done when all checklist items are complete
                ...(isFullyComplete && !task.checked ? { checked: true } : {}),
              };
            }
            return task;
          }),
        };
      }
      return goal;
    }));
  };

  // Delete a task
  const handleDeleteTask = (taskId: string) => {
    if (!activeGoalId) return;
    setGoals(prev => prev.map(goal => {
      if (goal.id === activeGoalId) {
        return {
          ...goal,
          tasks: goal.tasks.filter(task => task.id !== taskId),
        };
      }
      return goal;
    }));
    setSelectedTaskId(null);
    setEditingDescription(false);
  };

  // Update goal background
  const _handleUpdateGoalBackground = (goalId: string, backgroundImage: string) => {
    setGoals(prev => prev.map(goal =>
      goal.id === goalId ? { ...goal, backgroundImage } : goal
    ));
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    if (activeGoalId === goalId) {
      setActiveGoalId(null);
      setViewMode('dashboard');
    }
  };

  const _handleMoveGoal = (goalId: string, newStatus: 'planning' | 'in_progress' | 'completed') => {
    setGoals(prev => prev.map(goal =>
      goal.id === goalId ? { ...goal, status: newStatus } : goal
    ));
  };

  // Auto-update status based on progress
  const _getAutoStatus = (goal: StoredGoal): 'planning' | 'in_progress' | 'completed' => {
    const progress = getGoalProgress(goal);
    if (progress.completed === progress.total && progress.total > 0) return 'completed';
    if (progress.completed > 0) return 'in_progress';
    return goal.status;
  };

  const handleBackToDashboard = () => {
    setActiveGoalId(null);
    setViewMode('home');
  };

  const handleStartNewGoal = () => {
    setViewMode('input');
    setInputValue('');
    setError('');
  };

  const handleCancelNewGoal = () => {
    setViewMode('dashboard');
    setFormState({
      goalType: null,
      goalText: '',
      questions: [],
      currentQuestionIndex: 0,
      answers: {},
      extracted: {},
    });
    setInputValue('');
    setError('');
  };

  const handleSelectGoal = (goalId: string) => {
    setActiveGoalId(goalId);
    setViewMode('tasks');
  };

  const getGoalProgress = (goal: StoredGoal) => {
    const completed = goal.tasks.filter(t => t.checked).length;
    const total = goal.tasks.length;
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };

  const getGoalEmoji = (type: string) => {
    switch (type) {
      case 'learning': return '📚';
      case 'travel': return '✈️';
      case 'cooking': return '🍳';
      case 'event': return '🎉';
      case 'job': return '💼';
      case 'fitness': return '💪';
      case 'moving': return '📦';
      case 'project': return '🚀';
      default: return '🎯';
    }
  };

  const completedCount = activeGoal?.tasks.filter(t => t.checked).length || 0;
  const totalCount = activeGoal?.tasks.length || 0;

  // Get selected task for modal
  const selectedTask = activeGoal?.tasks.find(t => t.id === selectedTaskId);

  // Get boards grouped by workspace - each goal is its own board
  const getBoardsByCategory = () => {
    const boards: Record<string, { id: string; name: string; image?: string; taskCount: number; goalId: string }[]> = {};

    workspaces.forEach(ws => {
      boards[ws.id] = [];
    });

    // Each goal is a separate board
    goals.forEach(goal => {
      // Determine which workspace this goal belongs to
      const catId = goal.type === 'travel' ? 'travel' :
                   goal.type === 'learning' ? 'learning' :
                   ['project', 'job', 'media'].includes(goal.type) ? 'projects' : 'personal';

      // Default images based on goal type or board type
      const defaultImages: Record<string, string> = {
        travel: boardBackgrounds[4],
        learning: boardBackgrounds[5],
        fitness: boardBackgrounds[7],
        cooking: boardBackgrounds[8],
        job: boardBackgrounds[9],
        project: boardBackgrounds[6],
        media: boardBackgrounds[6],
        tvshows: boardBackgrounds[6],
        movies: boardBackgrounds[6],
        anime: boardBackgrounds[6],
        books: boardBackgrounds[5],
        games: boardBackgrounds[6],
      };

      const boardType = goal.details?.boardType || goal.type;

      boards[catId].push({
        id: goal.id,
        goalId: goal.id,
        name: goal.goal,
        image: goal.backgroundImage || defaultImages[boardType] || boardBackgrounds[0],
        taskCount: goal.tasks.length,
      });
    });

    return boards;
  };

  // Home view - Workspaces and Boards
  if (viewMode === 'home') {
    const boardsByCategory = getBoardsByCategory();
    const recentGoals = [...goals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

    return (
      <div className="min-h-screen bg-[#1d2125]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1d2125] via-[#22272b] to-[#1d2125] border-b border-[#3d444d]/50 px-6 py-4 sticky top-0 z-10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#579dff] to-[#4a8fe8] flex items-center justify-center shadow-lg shadow-[#579dff]/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Smart Kanban</h1>
                <p className="text-xs text-[#9fadbc]">Plan smarter, achieve more</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {/* Import Button */}
              <label className="group px-3 py-2 rounded-lg text-[#9fadbc] hover:text-white hover:bg-white/5
                              transition-all duration-200 text-sm flex items-center gap-2 cursor-pointer">
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="hidden sm:inline">Import</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleTrelloImport(file);
                    e.target.value = '';
                  }}
                />
              </label>

              <div className="w-px h-6 bg-[#3d444d]/50 mx-1" />

              {/* Calendar */}
              <button
                onClick={() => setViewMode('calendar')}
                className="group px-3 py-2 rounded-lg text-[#9fadbc] hover:text-white hover:bg-white/5
                         transition-all duration-200 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Calendar</span>
              </button>

              {/* Profile */}
              <button
                onClick={() => setViewMode('profile')}
                className="group px-3 py-2 rounded-lg text-[#9fadbc] hover:text-white hover:bg-white/5
                         transition-all duration-200 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:inline">Profile</span>
              </button>

              {/* Ideas */}
              <button
                onClick={() => setViewMode('ideas')}
                className="group px-3 py-2 rounded-lg text-[#9fadbc] hover:text-white hover:bg-white/5
                         transition-all duration-200 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="hidden sm:inline">Ideas</span>
              </button>

              <div className="w-px h-6 bg-[#3d444d]/50 mx-1" />

              {/* Create Button - Primary CTA */}
              <button
                onClick={handleStartNewGoal}
                className="px-4 py-2 bg-gradient-to-r from-[#579dff] to-[#4a8fe8] hover:from-[#4a8fe8] hover:to-[#3d7fd6]
                         text-white font-semibold rounded-lg transition-all duration-200 text-sm
                         shadow-lg shadow-[#579dff]/25 hover:shadow-[#579dff]/40 hover:scale-105
                         flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Goal
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Recently Viewed */}
          {recentGoals.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-[#9fadbc] font-semibold">Recently viewed</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {recentGoals.map(goal => (
                  <div
                    key={goal.id}
                    onClick={() => {
                      setActiveGoalId(goal.id);
                      setViewMode('goal');
                      setSelectedBackground(goal.backgroundImage || boardBackgrounds[0]);
                    }}
                    className="rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-all group"
                  >
                    <div
                      className="h-24 relative bg-cover bg-center"
                      style={{
                        backgroundImage: goal.backgroundImage
                          ? `url('${goal.backgroundImage}')`
                          : `linear-gradient(135deg, #0079bf 0%, #0067a3 100%)`
                      }}
                    >
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all" />
                    </div>
                    <div className="bg-[#22272b] p-3">
                      <h3 className="text-[#b6c2cf] text-sm font-medium truncate">{goal.goal}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your Workspaces */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[#9fadbc] text-xs font-semibold uppercase tracking-wider">Your Workspaces</h2>
              <button
                onClick={() => {
                  setEditingWorkspace(null);
                  setNewWorkspaceName('');
                  setNewWorkspaceColor('#0079bf');
                  setNewWorkspaceImage('');
                  setShowWorkspaceModal(true);
                }}
                className="px-3 py-1.5 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Workspace
              </button>
            </div>

            {workspaces.map(workspace => {
              const workspaceBoards = boardsByCategory[workspace.id] || [];

              return (
                <div key={workspace.id} className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm bg-cover bg-center"
                        style={{
                          backgroundColor: workspace.backgroundImage ? 'transparent' : workspace.color,
                          backgroundImage: workspace.backgroundImage ? `url('${workspace.backgroundImage}')` : 'none'
                        }}
                      >
                        {!workspace.backgroundImage && workspace.name[0]}
                      </div>
                      <h3 className="text-white font-semibold">{workspace.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditWorkspace(workspace)}
                        className="p-1.5 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                        title="Edit workspace"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete workspace "${workspace.name}"?`)) {
                            handleDeleteWorkspace(workspace.id);
                          }
                        }}
                        className="p-1.5 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                        title="Delete workspace"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setActiveBoardCategory(workspace.id);
                          setViewMode('dashboard');
                        }}
                        className="px-3 py-1.5 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                        Boards
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workspaceBoards.map(board => {
                      const goal = goals.find(g => g.id === board.goalId);
                      const tasks = goal?.tasks || [];
                      const completedTasks = tasks.filter(t => t.checked).length;
                      const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

                      return (
                        <div
                          key={board.id}
                          onClick={() => {
                            setActiveGoalId(board.goalId);
                            setViewMode('goal');
                            if (goal?.backgroundImage) {
                              setSelectedBackground(goal.backgroundImage);
                            }
                          }}
                          className="bg-[#22272b] rounded-xl overflow-hidden cursor-pointer hover:bg-[#282e33]
                                   transition-all group border border-[#3d444d]/50 hover:border-[#3d444d]"
                        >
                          {/* Board Header */}
                          <div
                            className="h-2 w-full"
                            style={{
                              background: board.image
                                ? `linear-gradient(90deg, ${workspace.color}, ${workspace.color}aa)`
                                : `linear-gradient(90deg, ${workspace.color}, ${workspace.color}aa)`
                            }}
                          />

                          <div className="p-4">
                            {/* Title and Progress */}
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="text-white font-medium text-sm flex-1 pr-2">{board.name}</h4>
                              {tasks.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#3d444d] text-[#9fadbc]">
                                  {progress}%
                                </span>
                              )}
                            </div>

                            {/* Task Preview */}
                            {tasks.length > 0 ? (
                              <div className="space-y-2">
                                {tasks.slice(0, 3).map((task, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <div className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center
                                                  ${task.checked
                                                    ? 'bg-green-500/20 border-green-500/50'
                                                    : 'border-[#3d444d]'}`}
                                    >
                                      {task.checked && (
                                        <svg className="w-2 h-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`truncate ${task.checked ? 'text-[#9fadbc] line-through' : 'text-[#b6c2cf]'}`}>
                                      {task.text}
                                    </span>
                                  </div>
                                ))}
                                {tasks.length > 3 && (
                                  <p className="text-[#9fadbc] text-xs pl-5">+{tasks.length - 3} more</p>
                                )}
                              </div>
                            ) : (
                              <div className="py-4 text-center">
                                <p className="text-[#9fadbc] text-xs mb-2">No tasks yet</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveGoalId(board.goalId);
                                    setViewMode('goal');
                                  }}
                                  className="text-[#579dff] text-xs hover:underline flex items-center gap-1 mx-auto"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add tasks
                                </button>
                              </div>
                            )}

                            {/* Footer Stats */}
                            {tasks.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#3d444d]/50 flex items-center justify-between">
                                <span className="text-[#9fadbc] text-xs">{completedTasks}/{tasks.length} completed</span>
                                <div className="w-16 h-1.5 bg-[#3d444d] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Create new board */}
                    <div
                      onClick={handleStartNewGoal}
                      className="bg-[#282e33]/50 hover:bg-[#282e33] rounded-xl border-2 border-dashed border-[#3d444d]/50
                               hover:border-[#3d444d] min-h-[160px] flex flex-col items-center justify-center gap-2
                               cursor-pointer transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#3d444d]/50 group-hover:bg-[#3d444d]
                                    flex items-center justify-center transition-all">
                        <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-[#9fadbc] text-sm">Create new board</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workspace Add/Edit Modal */}
          {showWorkspaceModal && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
              onClick={() => setShowWorkspaceModal(false)}
            >
              <div
                className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    {editingWorkspace ? 'Edit Workspace' : 'Add Workspace'}
                  </h2>
                  <button
                    onClick={() => setShowWorkspaceModal(false)}
                    className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">Name</label>
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="Workspace name"
                      className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                               focus:outline-none focus:border-[#579dff] text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {['#0079bf', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc', '#838c91'].map(color => (
                        <button
                          key={color}
                          onClick={() => setNewWorkspaceColor(color)}
                          className={`w-8 h-8 rounded ${newWorkspaceColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1f26]' : ''}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">Background Image (optional)</label>
                    <div className="grid grid-cols-5 gap-2">
                      <button
                        onClick={() => setNewWorkspaceImage('')}
                        className={`h-12 rounded bg-[#22272b] border ${!newWorkspaceImage ? 'border-[#579dff]' : 'border-[#3d444d]'}
                                  flex items-center justify-center text-[#9fadbc] text-xs`}
                      >
                        None
                      </button>
                      {boardBackgrounds.slice(0, 9).map((bg, idx) => (
                        <button
                          key={idx}
                          onClick={() => setNewWorkspaceImage(bg)}
                          className={`h-12 rounded bg-cover bg-center ${newWorkspaceImage === bg ? 'ring-2 ring-[#579dff]' : ''}`}
                          style={{ backgroundImage: `url('${bg}')` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      onClick={() => setShowWorkspaceModal(false)}
                      className="px-4 py-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingWorkspace ? handleUpdateWorkspace : handleAddWorkspace}
                      disabled={!newWorkspaceName.trim()}
                      className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded text-sm
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingWorkspace ? 'Save' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Importing Progress Modal */}
          {isImporting && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-[#1a1f26] rounded-xl w-full max-w-sm shadow-2xl p-8 text-center">
                {/* Spinning loader */}
                <div className="mb-6 flex justify-center">
                  <div className="w-16 h-16 border-4 border-[#3d444d] border-t-[#579dff] rounded-full animate-spin"></div>
                </div>

                <h2 className="text-xl font-semibold text-white mb-2">Importing Board</h2>
                <p className="text-[#9fadbc] text-sm mb-6">{importProgress.status}</p>

                {/* Progress bar */}
                {importProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="h-2 bg-[#22272b] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#579dff] transition-all duration-300"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-[#9fadbc] text-xs">
                      {importProgress.current} / {importProgress.total} cards enriched
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trello Import Result Modal */}
          {showTrelloImportModal && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
              onClick={() => {
                setPendingImportGoal(null);
                setTrelloImportResult(null);
                setShowTrelloImportModal(false);
              }}
            >
              <div
                className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    {trelloImportError ? (
                      <>
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Import Error
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Import Preview
                      </>
                    )}
                  </h2>
                  <button
                    onClick={() => {
                      setPendingImportGoal(null);
                      setTrelloImportResult(null);
                      setShowTrelloImportModal(false);
                    }}
                    className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {trelloImportError ? (
                    <p className="text-red-400 text-sm">{trelloImportError}</p>
                  ) : trelloImportResult && (
                    <div className="space-y-4">
                      <div className="bg-[#22272b] rounded-lg p-4">
                        <p className="text-[#9fadbc] text-sm mb-2">Board imported:</p>
                        <p className="text-white font-medium text-lg">{trelloImportResult.boardName}</p>
                      </div>

                      {/* Main stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#22272b] rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-[#579dff]">{trelloImportResult.tasksCreated}</p>
                          <p className="text-[#9fadbc] text-xs">Cards</p>
                        </div>
                        <div className="bg-[#22272b] rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-[#579dff]">{trelloImportResult.listsImported}</p>
                          <p className="text-[#9fadbc] text-xs">Lists</p>
                        </div>
                      </div>

                      {/* Detailed stats */}
                      <div className="bg-[#22272b] rounded-lg p-4">
                        <p className="text-[#9fadbc] text-xs mb-3 uppercase tracking-wider">Also imported:</p>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-lg font-semibold text-white">{trelloImportResult.checklistsImported}</p>
                            <p className="text-[#9fadbc] text-xs">Checklists</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-white">{trelloImportResult.attachmentsImported}</p>
                            <p className="text-[#9fadbc] text-xs">Attachments</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-white">{trelloImportResult.commentsImported}</p>
                            <p className="text-[#9fadbc] text-xs">Comments</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-[#579dff]">{trelloImportResult.linksExtracted}</p>
                            <p className="text-[#9fadbc] text-xs">Links</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-[#9fadbc] text-xs">
                        Ready to import with all checklists, attachments, comments, links, labels, due dates, and members.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setPendingImportGoal(null);
                        setTrelloImportResult(null);
                        setShowTrelloImportModal(false);
                      }}
                      className="px-4 py-2 bg-[#3d444d] hover:bg-[#4d545d] text-white rounded text-sm"
                    >
                      Cancel
                    </button>
                    {pendingImportGoal && (
                      <button
                        onClick={() => {
                          setGoals(prev => [...prev, pendingImportGoal]);
                          setPendingImportGoal(null);
                          setShowTrelloImportModal(false);
                        }}
                        className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded text-sm"
                      >
                        Import
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* My Info Modal */}
        {showMyInfo && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
            onClick={() => setShowMyInfo(false)}
          >
            <div
              className="bg-[#1a1f26] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-[#1a1f26] px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-[#579dff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-white">My Info</h2>
                </div>
                <button
                  onClick={() => setShowMyInfo(false)}
                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <p className="text-[#9fadbc] text-sm mb-6">
                  Store your personal information here. The app will use this to automatically determine which tasks are already done or not needed.
                </p>

                {/* Add New Info Form */}
                <div className="bg-[#22272b] rounded-lg p-4 mb-6">
                  <h3 className="text-[#b6c2cf] font-semibold text-sm mb-3">Add New Information</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[#9fadbc] text-xs mb-1 block">Category</label>
                      <select
                        value={newInfoCategory}
                        onChange={(e) => setNewInfoCategory(e.target.value as UserInfoItem['category'])}
                        className="w-full bg-[#1a1f26] border border-[#3d444d] rounded px-3 py-2 text-white text-sm
                                 focus:outline-none focus:border-[#579dff]"
                      >
                        <option value="travel">Travel</option>
                        <option value="skills">Skills</option>
                        <option value="certifications">Certifications</option>
                        <option value="personal">Personal</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[#9fadbc] text-xs mb-1 block">Expiry Date (optional)</label>
                      <input
                        type="date"
                        value={newInfoExpiry}
                        onChange={(e) => setNewInfoExpiry(e.target.value)}
                        className="w-full bg-[#1a1f26] border border-[#3d444d] rounded px-3 py-2 text-white text-sm
                                 focus:outline-none focus:border-[#579dff]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[#9fadbc] text-xs mb-1 block">Label</label>
                      <input
                        type="text"
                        value={newInfoLabel}
                        onChange={(e) => setNewInfoLabel(e.target.value)}
                        placeholder="e.g., Passport Expiry"
                        className="w-full bg-[#1a1f26] border border-[#3d444d] rounded px-3 py-2 text-white text-sm
                                 placeholder-white/30 focus:outline-none focus:border-[#579dff]"
                      />
                    </div>
                    <div>
                      <label className="text-[#9fadbc] text-xs mb-1 block">Value</label>
                      <input
                        type="text"
                        value={newInfoValue}
                        onChange={(e) => setNewInfoValue(e.target.value)}
                        placeholder="e.g., 2030-05-15"
                        className="w-full bg-[#1a1f26] border border-[#3d444d] rounded px-3 py-2 text-white text-sm
                                 placeholder-white/30 focus:outline-none focus:border-[#579dff]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddUserInfo}
                    disabled={!newInfoLabel.trim() || !newInfoValue.trim()}
                    className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] disabled:bg-[#3d444d] disabled:cursor-not-allowed
                             text-white text-sm font-medium rounded transition-all"
                  >
                    Add Info
                  </button>
                </div>

                {/* Existing Info List */}
                <div>
                  <h3 className="text-[#b6c2cf] font-semibold text-sm mb-3">Stored Information</h3>
                  {userInfo.length === 0 ? (
                    <p className="text-[#9fadbc] text-sm italic">No information stored yet. Add some above!</p>
                  ) : (
                    <div className="space-y-2">
                      {['travel', 'skills', 'certifications', 'personal', 'other'].map(cat => {
                        const catInfo = userInfo.filter(i => i.category === cat);
                        if (catInfo.length === 0) return null;
                        return (
                          <div key={cat} className="bg-[#22272b] rounded-lg overflow-hidden">
                            <div className="px-4 py-2 border-b border-[#3d444d]">
                              <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                                {cat}
                              </h4>
                            </div>
                            <div className="p-2 space-y-1">
                              {catInfo.map(info => {
                                const isExpired = info.expiryDate && new Date(info.expiryDate) < new Date();
                                const isExpiringSoon = info.expiryDate && !isExpired &&
                                  new Date(info.expiryDate) < new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
                                return (
                                  <div
                                    key={info.id}
                                    className="flex items-center justify-between px-3 py-2 bg-[#1a1f26] rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-white text-sm font-medium">{info.label}</span>
                                        {isExpired && (
                                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Expired</span>
                                        )}
                                        {isExpiringSoon && (
                                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Expiring Soon</span>
                                        )}
                                      </div>
                                      <p className="text-[#9fadbc] text-sm">{info.value}</p>
                                      {info.expiryDate && (
                                        <p className="text-[#9fadbc] text-xs mt-0.5">
                                          Expires: {new Date(info.expiryDate).toLocaleDateString()}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleDeleteUserInfo(info.id)}
                                      className="p-1.5 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Calendar view
  if (viewMode === 'calendar') {
    const calendarDays = getCalendarDays(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth());
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDateEvents = getEventsForDate(selectedCalendarDate);

    return (
      <div className="min-h-screen bg-[#1d2125]">
        {/* Header */}
        <div className="bg-[#1d2125] border-b border-[#3d444d] px-4 py-3 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setViewMode('home')}
              className="flex items-center gap-2 text-[#9fadbc] hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-bold text-white">Calendar</h1>
            <div className="flex items-center gap-2">
              <label className="px-4 py-2 bg-[#3d444d] hover:bg-[#4d545d] text-white font-medium
                             rounded transition-all text-sm flex items-center gap-2 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import .ics
                <input
                  type="file"
                  accept=".ics"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportICS(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const today = new Date();
                  setNewEventDate(today.toISOString().split('T')[0]);
                  setShowAddEventModal(true);
                }}
                className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white font-medium
                         rounded transition-all text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Event
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Grid */}
            <div className="lg:col-span-2 bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() - 1, 1))}
                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-white font-semibold text-lg">
                  {monthNames[selectedCalendarDate.getMonth()]} {selectedCalendarDate.getFullYear()}
                </h2>
                <button
                  onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() + 1, 1))}
                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-[#9fadbc] text-xs font-medium py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const dayEvents = getEventsForDate(day.date);
                  const isToday = day.date.getTime() === today.getTime();
                  const isSelected = day.date.toDateString() === selectedCalendarDate.toDateString();

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCalendarDate(day.date)}
                      className={`aspect-square p-1 rounded-lg transition-all relative
                                ${day.isCurrentMonth ? 'text-white' : 'text-[#9fadbc]/50'}
                                ${isSelected ? 'bg-[#579dff]' : isToday ? 'bg-[#3d444d]' : 'hover:bg-[#3d444d]'}`}
                    >
                      <span className="text-sm">{day.date.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                          {dayEvents.slice(0, 3).map((_, i) => (
                            <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#579dff]'}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Events List */}
            <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
              <h3 className="text-white font-semibold mb-4">
                {selectedCalendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>

              {selectedDateEvents.length === 0 ? (
                <p className="text-[#9fadbc] text-sm">No events for this day</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map(event => (
                    <div
                      key={event.id}
                      className="bg-[#1a1f26] rounded-lg p-3 border border-[#3d444d]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm">{event.title}</h4>
                          {!event.isAllDay && (
                            <p className="text-[#9fadbc] text-xs mt-1">
                              {event.startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              {event.endDate && ` - ${event.endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                            </p>
                          )}
                          {event.isAllDay && (
                            <p className="text-[#9fadbc] text-xs mt-1">All day</p>
                          )}
                          {event.location && (
                            <p className="text-[#9fadbc] text-xs mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {event.location}
                            </p>
                          )}
                          {event.source === 'imported' && event.sourceFile && (
                            <p className="text-[#9fadbc]/60 text-xs mt-1">Imported from {event.sourceFile}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteCalendarEvent(event.id)}
                          className="p-1 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upcoming Events */}
              {calendarEvents.length > 0 && (
                <div className="mt-6 pt-4 border-t border-[#3d444d]">
                  <h4 className="text-[#9fadbc] text-xs font-semibold uppercase tracking-wider mb-3">Upcoming Events</h4>
                  <div className="space-y-2">
                    {calendarEvents
                      .filter(e => new Date(e.startDate) >= today)
                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                      .slice(0, 5)
                      .map(event => (
                        <div
                          key={event.id}
                          onClick={() => setSelectedCalendarDate(new Date(event.startDate))}
                          className="text-sm text-[#9fadbc] hover:text-white cursor-pointer transition-all"
                        >
                          <span className="text-[#579dff] text-xs mr-2">
                            {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {event.title}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Event Modal */}
        {showAddEventModal && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
            onClick={() => setShowAddEventModal(false)}
          >
            <div
              className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Add Event</h2>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Title</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="Event title"
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={newEventIsAllDay}
                    onChange={(e) => setNewEventIsAllDay(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#22272b] border-[#3d444d]"
                  />
                  <label htmlFor="allDay" className="text-[#9fadbc] text-sm">All day event</label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">Start Date</label>
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                               focus:outline-none focus:border-[#579dff] text-sm"
                    />
                  </div>
                  {!newEventIsAllDay && (
                    <div>
                      <label className="text-[#9fadbc] text-sm mb-2 block">Start Time</label>
                      <input
                        type="time"
                        value={newEventTime}
                        onChange={(e) => setNewEventTime(e.target.value)}
                        className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                                 focus:outline-none focus:border-[#579dff] text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">End Date</label>
                    <input
                      type="date"
                      value={newEventEndDate}
                      onChange={(e) => setNewEventEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                               focus:outline-none focus:border-[#579dff] text-sm"
                    />
                  </div>
                  {!newEventIsAllDay && (
                    <div>
                      <label className="text-[#9fadbc] text-sm mb-2 block">End Time</label>
                      <input
                        type="time"
                        value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)}
                        className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                                 focus:outline-none focus:border-[#579dff] text-sm"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Location (optional)</label>
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Event location"
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowAddEventModal(false)}
                    className="px-4 py-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCalendarEvent}
                    disabled={!newEventTitle.trim() || !newEventDate}
                    className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Profile view - Personal information with templates
  if (viewMode === 'profile') {
    const filteredTemplates = customProfileFields.filter(t => t.category === activeProfileCategory);
    const completion = getProfileCompletion();
    const activeCategory = customProfileCategories.find(c => c.id === activeProfileCategory);

    return (
      <div className="min-h-screen bg-[#1d2125]">
        {/* Header */}
        <div className="bg-[#1d2125] border-b border-[#3d444d] px-4 py-3 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setViewMode('home')}
              className="flex items-center gap-2 text-[#9fadbc] hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-bold text-white">My Profile</h1>
            <div className="w-16" />
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Completion Card */}
          <div className="bg-[#22272b] rounded-xl p-6 mb-6 border border-[#3d444d]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold text-lg">Profile Completion</h2>
                <p className="text-[#9fadbc] text-sm">Fill in your information to enable smart task detection</p>
              </div>
              <div className="text-3xl font-bold text-[#579dff]">{completion}%</div>
            </div>
            <div className="h-3 bg-[#1a1f26] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#579dff] transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 items-center">
            {customProfileCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveProfileCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2
                          ${activeProfileCategory === cat.id
                            ? 'bg-[#579dff] text-white'
                            : 'bg-[#22272b] text-[#9fadbc] hover:bg-[#3d444d] hover:text-white'
                          }`}
              >
                <span>{cat.icon}</span>
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => {
                setNewCategoryName('');
                setNewCategoryIcon('📁');
                setShowAddCategoryModal(true);
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1
                        bg-[#22272b] text-[#9fadbc] hover:bg-[#3d444d] hover:text-white border border-dashed border-[#3d444d]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          {/* Category Header with Delete */}
          {activeCategory && (
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>{activeCategory.icon}</span>
                {activeCategory.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNewFieldLabel('');
                    setNewFieldCategory(activeProfileCategory);
                    setNewFieldHasExpiry(false);
                    setNewFieldHasDocument(true);
                    setNewFieldPlaceholder('');
                    setNewFieldIcon('📝');
                    setShowAddFieldModal(true);
                  }}
                  className="px-3 py-1.5 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Field
                </button>
                {!['travel', 'identity', 'health', 'skills', 'education'].includes(activeCategory.id) && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete category "${activeCategory.name}" and all its fields?`)) {
                        handleDeleteProfileCategory(activeCategory.id);
                        setActiveProfileCategory(customProfileCategories[0]?.id || 'travel');
                      }
                    }}
                    className="px-3 py-1.5 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded text-sm flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Category
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Profile Fields */}
          <div className="space-y-4">
            {filteredTemplates.map(template => {
              const data = profileData[template.id] || {};
              const isExpired = data.expiryDate && new Date(data.expiryDate) < new Date();
              const isExpiringSoon = data.expiryDate && !isExpired &&
                new Date(data.expiryDate) < new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);

              return (
                <div
                  key={template.id}
                  className={`bg-[#22272b] rounded-xl p-4 border transition-all
                            ${isExpired ? 'border-red-500/50' : isExpiringSoon ? 'border-yellow-500/50' : 'border-[#3d444d]'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{template.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium">{template.label}</h3>
                          {isExpired && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Expired</span>
                          )}
                          {isExpiringSoon && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Expiring Soon</span>
                          )}
                          {data.value && !isExpired && !isExpiringSoon && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Complete</span>
                          )}
                        </div>
                        {!profileTemplates.find(pt => pt.id === template.id) && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete field "${template.label}"?`)) {
                                handleDeleteProfileField(template.id);
                              }
                            }}
                            className="p-1.5 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                            title="Delete field"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Value Input */}
                        <div>
                          <label className="text-[#9fadbc] text-xs mb-1 block">Value</label>
                          <input
                            type="text"
                            value={data.value || ''}
                            onChange={(e) => handleUpdateProfileField(template.id, e.target.value, data.expiryDate)}
                            placeholder={template.placeholder}
                            className="w-full bg-[#1a1f26] border border-[#3d444d] rounded-lg px-3 py-2 text-white text-sm
                                     placeholder-white/30 focus:outline-none focus:border-[#579dff]"
                          />
                        </div>

                        {/* Expiry Date Input */}
                        {template.hasExpiry && (
                          <div>
                            <label className="text-[#9fadbc] text-xs mb-1 block">Expiry Date</label>
                            <input
                              type="date"
                              value={data.expiryDate || ''}
                              onChange={(e) => handleUpdateProfileField(template.id, data.value || '', e.target.value)}
                              className="w-full bg-[#1a1f26] border border-[#3d444d] rounded-lg px-3 py-2 text-white text-sm
                                       focus:outline-none focus:border-[#579dff]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Document Upload */}
                      {template.hasDocument && (
                        <div className="mt-3">
                          <label className="text-[#9fadbc] text-xs mb-1 block">Supporting Document</label>
                          {data.documentName ? (
                            <div className="flex items-center gap-3 bg-[#1a1f26] rounded-lg p-3">
                              <svg className="w-8 h-8 text-[#579dff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm truncate">{data.documentName}</p>
                                <p className="text-[#9fadbc] text-xs">{data.documentType}</p>
                              </div>
                              <div className="flex gap-2">
                                {data.documentData && (
                                  <a
                                    href={data.documentData}
                                    download={data.documentName}
                                    className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                                    title="Download"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </a>
                                )}
                                <button
                                  onClick={() => handleRemoveProfileDocument(template.id)}
                                  className="p-2 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                                  title="Remove"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex items-center gap-3 bg-[#1a1f26] hover:bg-[#282e33] rounded-lg p-3 cursor-pointer transition-all border border-dashed border-[#3d444d]">
                              <svg className="w-6 h-6 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              <span className="text-[#9fadbc] text-sm">Click to upload document (PDF, Image)</span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleProfileDocumentUpload(template.id, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Category Modal */}
        {showAddCategoryModal && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
            onClick={() => setShowAddCategoryModal(false)}
          >
            <div
              className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Add Category</h2>
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>

                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {['📁', '💼', '🏠', '🎯', '📊', '🔧', '📱', '🎨', '🏃', '📚', '💰', '🌍'].map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewCategoryIcon(icon)}
                        className={`w-10 h-10 rounded text-xl flex items-center justify-center
                                  ${newCategoryIcon === icon ? 'bg-[#579dff]' : 'bg-[#22272b] hover:bg-[#3d444d]'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowAddCategoryModal(false)}
                    className="px-4 py-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProfileCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Field Modal */}
        {showAddFieldModal && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
            onClick={() => setShowAddFieldModal(false)}
          >
            <div
              className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Add Field</h2>
                <button
                  onClick={() => setShowAddFieldModal(false)}
                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Label</label>
                  <input
                    type="text"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="e.g., Emergency Contact"
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>

                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Placeholder</label>
                  <input
                    type="text"
                    value={newFieldPlaceholder}
                    onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                    placeholder="e.g., Enter phone number"
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>

                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {['📝', '📄', '🔑', '📧', '📞', '🏷️', '💳', '🎫', '📋', '🔗', '⚙️', '📌'].map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewFieldIcon(icon)}
                        className={`w-10 h-10 rounded text-xl flex items-center justify-center
                                  ${newFieldIcon === icon ? 'bg-[#579dff]' : 'bg-[#22272b] hover:bg-[#3d444d]'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldHasExpiry}
                      onChange={(e) => setNewFieldHasExpiry(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#22272b] border-[#3d444d]"
                    />
                    <span className="text-[#9fadbc] text-sm">Has expiry date</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldHasDocument}
                      onChange={(e) => setNewFieldHasDocument(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#22272b] border-[#3d444d]"
                    />
                    <span className="text-[#9fadbc] text-sm">Has document</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowAddFieldModal(false)}
                    className="px-4 py-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProfileField}
                    disabled={!newFieldLabel.trim()}
                    className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Ideas view - Idea Scraper
  if (viewMode === 'ideas') {
    return <IdeasView onBack={() => setViewMode('home')} />;
  }

  // Dashboard view - Trello-style board
  if (viewMode === 'dashboard') {
    // Group goals by category/type
    const goalsByCategory: Record<string, StoredGoal[]> = {};
    categoryColumns.forEach(col => {
      goalsByCategory[col.id] = goals.filter(g => g.type === col.id);
    });
    // Put uncategorized goals in "other"
    const categorizedTypes = categoryColumns.map(c => c.id);
    const uncategorized = goals.filter(g => !categorizedTypes.includes(g.type));
    goalsByCategory['other'] = [...(goalsByCategory['other'] || []), ...uncategorized];

    // Get visible columns based on column order
    const orderedColumns = columnOrder
      .map(id => categoryColumns.find(c => c.id === id)!)
      .filter(Boolean);

    const visibleColumns = orderedColumns.filter(col =>
      goalsByCategory[col.id]?.length > 0
    );

    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: `url('${boardBackground.replace('w=400', 'w=1920')}')`,
        }}
      >
        {/* Header - Trello style */}
        <div className="bg-black/50 backdrop-blur-[2px] px-4 py-2.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode('home')}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
              <h1 className="text-lg font-bold text-white">Planner</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-all"
                  title="Change background"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                {/* Background Picker Dropdown */}
                {showBackgroundPicker && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#282e33] rounded-lg shadow-xl border border-[#3d444d] z-50">
                    <div className="p-3 border-b border-[#3d444d]">
                      <h3 className="text-white font-semibold text-sm">Board Background</h3>
                      <p className="text-[#9fadbc] text-xs mt-1">Choose a photo for your board</p>
                    </div>
                    <div className="p-3 grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {boardBackgrounds.map((bg, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setBoardBackground(bg);
                            setShowBackgroundPicker(false);
                          }}
                          className={`h-16 rounded-lg overflow-hidden relative group
                                    ${boardBackground === bg ? 'ring-2 ring-[#579dff]' : ''}`}
                        >
                          <img
                            src={bg}
                            alt={`Background ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                          {boardBackground === bg && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleStartNewGoal}
                className="px-3 py-1.5 bg-[#579dff] hover:bg-[#4a8fe8] text-white font-medium
                         rounded transition-all flex items-center gap-1.5 text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>

        {/* Trello-style Board with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="p-3 overflow-x-auto h-[calc(100vh-95px)]">
            <div className="flex gap-3 items-start h-full">
              <SortableContext items={visibleColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                {visibleColumns.map(column => {
                  const columnGoals = goalsByCategory[column.id] || [];
                  return (
                    <SortableColumn
                      key={column.id}
                      column={column}
                      goals={columnGoals}
                      onSelectGoal={handleSelectGoal}
                      onDeleteGoal={handleDeleteGoal}
                      onAddCard={handleStartNewGoal}
                      getProgress={getGoalProgress}
                    />
                  );
                })}
              </SortableContext>

              {/* Add another list button */}
              <button
                onClick={handleStartNewGoal}
                className="w-[272px] flex-shrink-0 px-3 py-2.5 bg-white/20 hover:bg-white/30
                         rounded-xl text-white text-sm font-medium
                         transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another list
              </button>
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeDragId && goals.find(g => g.id === activeDragId) ? (
              <div className="bg-[#22272b] rounded-lg px-3 py-2 shadow-2xl rotate-3 w-[250px]">
                <h3 className="text-[#b6c2cf] text-sm">
                  {goals.find(g => g.id === activeDragId)?.goal}
                </h3>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

      </div>
    );
  }

  // New goal input view - with same background
  if (viewMode === 'input') {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)),
                           url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')`,
        }}
      >
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 px-4 py-2 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={handleCancelNewGoal}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Board
            </button>
            <h1 className="text-lg font-bold text-white">🎯 Add New Goal</h1>
            <div className="w-24"></div>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-60px)]">
          <div className="w-full max-w-lg bg-[#1a1f26] rounded-xl p-6 shadow-2xl border border-[#5a6370]">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">What do you want to accomplish?</h2>
              <p className="text-white/50 text-sm">I'll create a personalized checklist with resources</p>
            </div>

            <form onSubmit={handleInitialSubmit} className="space-y-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError('');
                }}
                placeholder="e.g., I want to learn Python, travel to Japan..."
                className="w-full px-4 py-3 bg-[#454d5a] border border-[#5a6370] rounded-lg
                         text-white placeholder-white/40 focus:outline-none focus:border-accent text-base"
                autoFocus
              />
              {error && <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-medium rounded-lg transition-all"
              >
                Continue
              </button>
            </form>

            <div className="mt-6">
              <p className="text-white/40 text-xs mb-3 text-center">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Learn Python', 'Travel to Japan', 'Get fit', 'Find a job', 'Plan a party', 'Start a project'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInputValue(`I want to ${suggestion.toLowerCase()}`)}
                    className="px-3 py-1.5 bg-[#454d5a] hover:bg-[#515a68]
                             rounded text-xs text-white/60 hover:text-white transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Questions view - with same background
  if (viewMode === 'questions') {
    const currentQuestion = formState.questions[formState.currentQuestionIndex];
    const progress = ((formState.currentQuestionIndex + 1) / formState.questions.length) * 100;

    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)),
                           url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')`,
        }}
      >
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 px-4 py-2 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={handleCancelNewGoal}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <h1 className="text-lg font-bold text-white">🎯 Setting up your goal</h1>
            <span className="text-white/50 text-sm">
              {formState.currentQuestionIndex + 1}/{formState.questions.length}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-60px)]">
          <div className="w-full max-w-lg bg-[#1a1f26] rounded-xl p-6 shadow-2xl border border-[#5a6370]">
            {/* Progress bar */}
            <div className="mb-6">
              <div className="h-1.5 bg-[#454d5a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-white mb-6">{currentQuestion.question}</h2>

            <div className="space-y-2">
              {currentQuestion.options?.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswerSelect(option)}
                  className="w-full px-4 py-3 bg-[#454d5a] hover:bg-[#515a68] border border-[#5a6370]
                           hover:border-accent/50 rounded-lg text-left text-white transition-all text-sm"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)),
                         url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')`,
      }}
    >
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 px-4 py-2 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white">
              {getGoalEmoji(activeGoal?.type || '')} {activeGoal?.goal}
            </h1>
            <button
              onClick={rescanContent}
              disabled={contentScanning}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-all ${
                contentScanning
                  ? 'text-white/30 bg-white/5 cursor-not-allowed'
                  : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
              }`}
              title={contentScanning ? `Scanning ${scannedCount}/${totalToScan}...` : 'Check for new seasons'}
            >
              <svg className={`w-3 h-3 ${contentScanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {contentScanning ? '' : 'Refresh'}
            </button>
          </div>
          <button
            onClick={() => handleDeleteGoal(activeGoalId!)}
            className="p-2 text-white/50 hover:text-red-400 hover:bg-white/10 rounded transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Kanban-style board layout - click and drag to scroll horizontally */}
      <div
        ref={boardScrollRef}
        className="p-3 overflow-x-auto h-[calc(100vh-60px)]"
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={handleBoardMouseLeave}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveTaskDragId(e.active.id as string)}
          onDragOver={handleTaskDragOver}
          onDragEnd={(e) => {
            handleTaskDragEnd(e);
            setActiveTaskDragId(null);
          }}
          onDragCancel={() => setActiveTaskDragId(null)}
        >
          <div className="flex gap-3 items-start h-full">
            {Object.entries(groupedTasks).map(([category, tasks]) => {
              // Get display name for category
              const categoryDisplayNames: Record<string, string> = {
                'to_watch': 'To Watch',
                'watching': 'Watching',
                'watched': 'Watched',
                'dropped': 'Dropped',
                'on_hold': 'On Hold',
                'tasks': 'Tasks',
                'custom': 'Custom',
              };
              const displayName = categoryDisplayNames[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

              return (
                <DroppableTaskColumn
                  key={category}
                  category={category}
                  displayName={displayName}
                  tasks={tasks}
                >
                  {/* Per-column SortableContext - only cards in THIS column shift */}
                  <SortableContext
                    items={tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tasks.map(task => {
                      const infoMatch = getTaskInfoMatch(task);
                      return (
                        <SortableTaskCardWrapper
                          key={task.id}
                          task={task}
                          onSelect={() => setSelectedTaskId(task.id)}
                          infoMatch={infoMatch}
                        />
                      );
                    })}
                  </SortableContext>

                  {/* Add task button/form for this category */}
                  {addingTaskToCategory === category ? (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        placeholder="Enter task title..."
                        autoFocus
                        className="w-full bg-[#22272b] border border-[#5a6370] rounded-lg px-3 py-2 text-white text-sm
                                 placeholder-white/40 focus:outline-none focus:border-accent mb-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTaskText.trim()) {
                            handleAddTask(newTaskText, category);
                          }
                          if (e.key === 'Escape') {
                            setAddingTaskToCategory(null);
                            setNewTaskText('');
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (newTaskText.trim()) {
                              handleAddTask(newTaskText, category);
                            }
                          }}
                          className="px-3 py-1.5 bg-[#579dff] hover:bg-[#4a8fe8] text-white text-xs font-medium rounded transition-all"
                        >
                          Add Task
                        </button>
                        <button
                          onClick={() => {
                            setAddingTaskToCategory(null);
                            setNewTaskText('');
                          }}
                          className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-[#3d444d] text-xs rounded transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingTaskToCategory(category);
                        setNewTaskText('');
                      }}
                      className="w-full px-3 py-2 text-[#9fadbc] hover:text-white hover:bg-[#22272b] text-sm
                               flex items-center gap-2 transition-all rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add a task
                    </button>
                  )}
                </DroppableTaskColumn>
              );
            })}

            {/* Add another list button */}
            <button
              onClick={() => {
                setAddingTaskToCategory('new_list');
                setNewTaskText('');
              }}
              className="w-[280px] flex-shrink-0 px-3 py-2.5 bg-white/20 hover:bg-white/30
                       rounded-xl text-white text-sm font-medium
                       transition-all flex items-center gap-2 h-fit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add another list
            </button>
            </div>

          {/* Drag overlay - shows dragged card without affecting original */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
            }}
          >
            {activeTaskDrag ? (
              <div className="rounded-lg shadow-lg px-3 py-2 bg-[#22272b] border-2 border-accent cursor-grabbing">
                <span className="text-sm text-white">{activeTaskDrag.text}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => { setSelectedTaskId(null); setEditingTaskId(null); setEditingDescription(false); }}
          onToggleTask={handleToggleTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onToggleChecklistItem={handleToggleChecklistItem}
          onAddChecklistItem={handleAddChecklistItem}
          formatCategoryName={formatCategoryName}
          renderDescriptionWithLinks={renderDescriptionWithLinks}
        />
      )}
    </div>
  );
}
