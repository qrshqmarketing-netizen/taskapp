// The five areas the team runs, the steps a task moves through and the starter tasks for each area.
// Shared by the server (validation) and the browser (labels, colors). Edit the starter tasks freely: they are only suggestions.

export const AREAS = [
  { id: 'website', label: 'Website', color: '#2563eb' },
  { id: 'facebook', label: 'Facebook Pages', color: '#7c3aed' },
  { id: 'gbp', label: 'Google Business Profile', short: 'GBP', color: '#16a34a' },
  { id: 'offpage', label: 'Off-page SEO', short: 'Off-page', color: '#ea580c' },
  { id: 'content', label: 'Content', color: '#db2777' },
];

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'review', label: 'Waiting / review' },
  { id: 'done', label: 'Done' },
];

export const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
];

// The disposition: how a task ended, picked when it is marked Done (shown on the card and in the list; "Completed" when none is picked)
export const DISPOSITIONS = [
  { id: 'completed', label: 'Completed' },
  { id: 'published', label: 'Published / posted' },
  { id: 'sent', label: 'Sent / submitted' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'rescheduled', label: 'Rescheduled' },
  { id: 'not_needed', label: 'Not needed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'blocked', label: 'Blocked / can’t do' },
];
export const dispositionName = (id) => DISPOSITIONS.find((d) => d.id === id)?.label || '';

// A repeating task makes its next copy, with the due date moved on, when it is marked Done
export const REPEATS = [
  { id: '', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Every month' },
  { id: 'quarterly', label: 'Every 3 months' },
];

export const areaOf = (id) => AREAS.find((a) => a.id === id) || AREAS[0];
export const areaName = (id) => areaOf(id).short || areaOf(id).label;
export const statusName = (id) => (STATUSES.find((s) => s.id === id) || STATUSES[0]).label;

const ids = (list) => list.map((x) => x.id);
export const AREA_IDS = ids(AREAS);
export const STATUS_IDS = ids(STATUSES);
export const PRIORITY_IDS = ids(PRIORITIES);
export const REPEAT_IDS = ids(REPEATS);
export const DISPOSITION_IDS = ids(DISPOSITIONS);

// The next due date of a repeating task (dates are YYYY-MM-DD, counted in UTC so a time zone never shifts the day)
export function nextDue(due, repeat) {
  const d = due ? new Date(`${due}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const add = { daily: [0, 1], weekly: [0, 7], biweekly: [0, 14], monthly: [1, 0], quarterly: [3, 0] }[repeat];
  if (!add) return due;
  if (add[0]) d.setUTCMonth(d.getUTCMonth() + add[0]);
  d.setUTCDate(d.getUTCDate() + add[1]);
  return d.toISOString().slice(0, 10);
}

// Starter tasks per area: a useful routine to begin with ("Add starter tasks" on an empty area). Due dates are set when they are added.
export const STARTER_TASKS = {
  website: [
    { title: 'Check Search Console: errors, new queries and pages losing clicks', repeat: 'weekly', priority: 'high' },
    { title: 'Check the estimate form and the thank-you page on phone and desktop', repeat: 'monthly' },
    { title: 'Run PageSpeed Insights on the home page and the top service pages', repeat: 'monthly' },
    { title: 'Update the Google review count on the site', repeat: 'monthly', priority: 'low' },
    { title: 'Review titles and descriptions of pages with impressions but no clicks', repeat: 'monthly' },
  ],
  facebook: [
    { title: 'Post a finished project with before and after photos', repeat: 'weekly', priority: 'high' },
    { title: 'Reply to comments and messages', repeat: 'daily' },
    { title: 'Share the newest blog article', repeat: 'monthly' },
    { title: 'Review Page insights: reach, clicks and calls', repeat: 'monthly', priority: 'low' },
  ],
  gbp: [
    { title: 'Publish a post on each office listing (project, tip or offer)', repeat: 'weekly', priority: 'high', notes: 'West Hollywood, Valley (Woodland Hills) and Vernon listings.' },
    { title: 'Reply to every new Google review', repeat: 'weekly', priority: 'high' },
    { title: 'Upload new job photos to each listing', repeat: 'weekly' },
    { title: 'Send review requests to customers with finished jobs', repeat: 'weekly' },
    { title: 'Check hours, services, Q&A and the website link on each listing', repeat: 'monthly' },
  ],
  offpage: [
    { title: 'Check citations match name, address and phone (Yelp, BBB, Angi, Houzz, Nextdoor)', repeat: 'monthly' },
    { title: 'Find one new local link opportunity (supplier, association, sponsorship, local news)', repeat: 'monthly' },
    { title: 'Review new and lost backlinks', repeat: 'monthly', priority: 'low' },
    { title: 'Fix any listing that shows an old address or phone number', repeat: 'quarterly' },
  ],
  content: [
    { title: 'Write and publish one blog article', repeat: 'biweekly', priority: 'high' },
    { title: 'Turn a finished job into a project page (photos, story, ZIP)', repeat: 'monthly' },
    { title: 'Refresh an older article: facts, links and date', repeat: 'monthly' },
    { title: 'Plan next month’s topics from Search Console questions', repeat: 'monthly' },
  ],
};
