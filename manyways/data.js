/* The register. Placeholder figures for the mock — swap for whatever the
   pool actually charges before this goes anywhere near a customer. */
window.LABS = {
  Anthropic: "#c9557d", OpenAI: "#7a9d6b", Google: "#c98a4b",
  Meta: "#6b8bc9", Mistral: "#c96b6b", Cohere: "#8b6bc9", DeepSeek: "#4bacc9"
};
window.MODELS = [
  { n: "Claude Opus 5",        id: "claude-opus-5",            lab: "Anthropic", ctx: 200000, in: 15,   out: 75,   s: "live" },
  { n: "Claude Sonnet 5",      id: "claude-sonnet-5",          lab: "Anthropic", ctx: 200000, in: 3,    out: 15,   s: "live" },
  { n: "Claude Haiku 4.5",     id: "claude-haiku-4-5",         lab: "Anthropic", ctx: 200000, in: 0.8,  out: 4,    s: "live" },
  { n: "GPT-5.2",              id: "gpt-5.2",                  lab: "OpenAI",    ctx: 400000, in: 10,   out: 30,   s: "live" },
  { n: "GPT-5.2 mini",         id: "gpt-5.2-mini",             lab: "OpenAI",    ctx: 400000, in: 0.6,  out: 2.4,  s: "live" },
  { n: "o4",                   id: "o4",                       lab: "OpenAI",    ctx: 200000, in: 12,   out: 48,   s: "queued" },
  { n: "Gemini 3 Pro",         id: "gemini-3-pro",             lab: "Google",    ctx: 1000000,in: 7,    out: 21,   s: "live" },
  { n: "Gemini 3 Flash",       id: "gemini-3-flash",           lab: "Google",    ctx: 1000000,in: 0.3,  out: 1.2,  s: "live" },
  { n: "Llama 4 405B",         id: "llama-4-405b",             lab: "Meta",      ctx: 128000, in: 2.4,  out: 2.4,  s: "live" },
  { n: "Llama 4 70B",          id: "llama-4-70b",              lab: "Meta",      ctx: 128000, in: 0.5,  out: 0.5,  s: "live" },
  { n: "Mistral Large 3",      id: "mistral-large-3",          lab: "Mistral",   ctx: 128000, in: 2,    out: 6,    s: "live" },
  { n: "Command A Plus",       id: "command-a-plus-05-2026",   lab: "Cohere",    ctx: 256000, in: 2.5,  out: 10,   s: "live" },
  { n: "Command A",            id: "command-a-03-2025",        lab: "Cohere",    ctx: 256000, in: 1.5,  out: 6,    s: "live" },
  { n: "DeepSeek V4",          id: "deepseek-v4",              lab: "DeepSeek",  ctx: 128000, in: 0.28, out: 1.1,  s: "live" }
];
