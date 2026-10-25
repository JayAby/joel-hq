// One short line a day. The same line all day, a new one tomorrow.
export const QUOTES = [
  'Small steps, taken daily, beat big plans.',
  'Do the next thing.',
  'Discipline is choosing what you want most over what you want now.',
  'You do not have to feel ready. Just start.',
  'Done is better than perfect.',
  'Consistency beats intensity.',
  'Show up, even on the slow days.',
  'The work you avoid is usually the work that matters.',
  'Ten focused minutes beat an hour of dreading it.',
  'Be the person your goals need.',
  'Progress, not perfection.',
  'Today is a chance to keep a promise to yourself.',
  'Motivation gets you started. Habit keeps you going.',
  'One good day at a time.',
  'Tired is not the same as finished.',
  'Make it easy to start and hard to quit.',
  'What you do today is a vote for who you become.',
  'Never miss twice.',
  'Focus on the next hour, not the whole mountain.',
  'Your future self is watching. Make them proud.',
  'Rest is part of the plan, not a break from it.',
  'Clear the small things so the big thing has room.',
  'Hard now, easy later.',
  'Start before you are comfortable.',
  'The best time was yesterday. The next best is now.',
  'You are building something. Keep laying bricks.',
  'Do it badly, then do it better.',
  'Energy follows action.',
  'Be stubborn about the goal, flexible about the route.',
  'A calm mind finishes more.',
  'Protect your focus like it is money.',
]

export function quoteFor(dayKey: string): string {
  let h = 0
  for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) >>> 0
  return QUOTES[h % QUOTES.length]
}

export function sceneSeed(dayKey: string): number {
  let h = 7
  for (let i = 0; i < dayKey.length; i++) h = (h * 17 + dayKey.charCodeAt(i)) >>> 0
  return h
}
