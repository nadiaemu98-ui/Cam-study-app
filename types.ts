export type StudyMode = 'Individual' | 'Group Study' | 'Pomodoro';

export interface HourlySnapshot {
  id: string;
  hourNumber: number;
  timestamp: string;
  topic: string;
  snapshotDataUrl?: string;
}

export interface SessionRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  mode: StudyMode;
  topics: string[];
  warningCount: number;
  efficiencyScore: number; // percentage e.g. 95%
  hourlySnapshots: HourlySnapshot[];
  notes?: string;
}

export interface BreakState {
  isActive: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  breakType: 'Short' | 'Long' | 'Custom';
}

export interface StudyRoomMember {
  id: string;
  name: string;
  avatar: string;
  status: 'studying' | 'on_break' | 'idle';
  currentTopic: string;
  warningCount: number;
  efficiencyScore: number;
  joinedAt: string;
  isHost?: boolean;
}

export interface RoomChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  targetHours: number;
  currentHours: number;
  endDate: string;
  rewardBadge: string;
  joined: boolean;
  description?: string;
  participantsCount?: number;
}

export interface StudyRoom {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  joinCode: string; // e.g. "TOTORO" or "789123"
  topic: string;
  hostName: string;
  maxMembers: number;
  members: StudyRoomMember[];
  icon: string; // lucide icon name or emoji
  themeColor: string; // e.g. 'emerald' | 'amber' | 'sky' | 'rose'
  chatMessages: RoomChatMessage[];
  createdAt: string;
  weeklyChallenge?: WeeklyChallenge;
}

export interface TodoTask {
  id: string;
  title: string;
  category: 'Study' | 'Homework' | 'Reading' | 'Project' | 'Personal';
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
  estimatedMinutes: number;
  completedMinutes: number;
  dueDate?: string;
  notes?: string;
  createdAt: string;
}

export interface StreakBadge {
  id: string;
  name: string;
  icon: string;
  requiredDays: number;
  description: string;
  unlockedAt?: string;
}

export interface FocusStreakData {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
  dailyGoalMinutes: number; // default e.g. 60 mins
  todayMinutes: number;
  unlockedBadgeIds: string[];
  badgeUnlockDates?: Record<string, string>;
}


