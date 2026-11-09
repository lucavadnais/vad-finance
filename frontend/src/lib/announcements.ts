// The new features announced once to each user (WhatsNewDialog), newest
// last. A key, once shipped, never changes: it is what the settings remember
// as seen (settings.seenAnnouncements).
export const ANNOUNCEMENTS = ['goals'] as const;
export type Announcement = (typeof ANNOUNCEMENTS)[number];
