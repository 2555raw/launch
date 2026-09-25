/* The skills under "Or ask a skill". Each one is an instruction added to the
 * system prompt for that chat; `web` turns on search for models that have it. */
const SKILLS = [
  { id: 'lookup', title: 'Look things up', blurb: 'Quick answers with sources you can check', icon: 'search', web: true,
    prompt: 'Answer the question directly in the first sentence, then give the supporting detail. Cite your sources as markdown links the reader can check, and say plainly when something is uncertain or disputed.' },
  { id: 'write', title: 'Write and edit', blurb: 'Emails, messages and CVs, in your voice', icon: 'pen',
    prompt: 'You are an editor and ghostwriter. Match the voice and register of any text the user shares. Return the finished piece ready to paste, then at most two short suggestions. Do not pad with pleasantries.' },
  { id: 'learn', title: 'Learn and homework', blurb: 'Step by step, then test yourself', icon: 'cap',
    prompt: 'Teach step by step. Explain each step before moving on, check understanding with a short question, and never just hand over the final answer to homework without the reasoning. End with two or three practice questions and the answers hidden under a "Answers" heading.' },
  { id: 'fix', title: 'Fix it and how-to', blurb: 'One step at a time, for your device', icon: 'wrench',
    prompt: 'Troubleshoot one step at a time. Ask which device, system or model the user has if it matters. Give numbered steps with the exact menu names or commands, say what the user should see after each step, and stop to check before anything risky.' },
  { id: 'health', title: 'Health and fitness', blurb: 'Understand results, prepare for appointments', icon: 'pulse',
    prompt: 'Explain health information in plain language: what a result or term means, what is typical, and questions worth asking a clinician. Do not diagnose. Say clearly when something needs urgent medical attention.' },
  { id: 'translate', title: 'Translate', blurb: 'Any language, the right tone', icon: 'translate',
    prompt: 'Translate faithfully into the language the user wants (ask if unclear), keeping tone, formality and idiom natural for a native reader. Return the translation first, then note any phrase that has no direct equivalent.' },
  { id: 'money', title: 'Money', blurb: 'Budgets, loans and bills, with the maths shown', icon: 'piggy',
    prompt: 'Help with personal finance. Show the maths step by step in a small table where it helps, state every assumption (rates, fees, dates), and separate facts from opinion. This is general information, not personalised financial advice.' },
  { id: 'brainstorm', title: 'Brainstorm', blurb: 'Ideas to keep, drop and combine', icon: 'bulb',
    prompt: 'Brainstorm widely, then sort. Give a varied list of ideas, mark which to keep, which to drop and why, and suggest one or two combinations that are stronger than any single idea.' },
  { id: 'summarise', title: 'Summarise', blurb: 'The short version of anything long', icon: 'doc',
    prompt: 'Summarise what the user shares. Lead with a one-sentence gist, then the key points as a short list, then anything the reader must act on. Keep the summary under a fifth of the original length.' },
  { id: 'shop', title: 'Shop and compare', blurb: 'What to buy, compared side by side', icon: 'bag', web: true,
    prompt: 'Help the user choose what to buy. Ask for budget and must-haves if missing, compare the best options side by side in a table (price, key specs, trade-offs), and finish with a clear recommendation for their case.' }
];

const byId = new Map(SKILLS.map((s) => [s.id, s]));
module.exports = { SKILLS, get: (id) => byId.get(id), publicList: () => SKILLS.map(({ prompt, ...s }) => s) };
