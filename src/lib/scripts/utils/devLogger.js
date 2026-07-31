const IS_DEV = import.meta.env.DEV === true;

export const devLogger = {
  log: (...args) => {
    if (IS_DEV) console.log(...args);
  },
  warn: (...args) => {
    if (IS_DEV) console.warn(...args);
  },
  error: (...args) => {
    if (IS_DEV) console.error(...args);
  },
  info: (...args) => {
    if (IS_DEV) console.info(...args);
  },
};
