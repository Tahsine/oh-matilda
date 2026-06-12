const PREFIX = {
  index: '\x1b[34m[index]\x1b[0m',
  search: '\x1b[32m[search]\x1b[0m',
  embed: '\x1b[33m[embed]\x1b[0m',
  file: '\x1b[35m[file]\x1b[0m',
  agent: '\x1b[36m[agent]\x1b[0m',
} as const;

type Tag = keyof typeof PREFIX;

function log(tag: Tag, ...args: unknown[]) {
  if (__DEV__) {
    console.log(PREFIX[tag], ...args);
  }
}

export const logger = {
  index: (...args: unknown[]) => log('index', ...args),
  search: (...args: unknown[]) => log('search', ...args),
  embed: (...args: unknown[]) => log('embed', ...args),
  file: (...args: unknown[]) => log('file', ...args),
  agent: (...args: unknown[]) => log('agent', ...args),
};
