const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
  info: (tag, msg, ...args) => {
    console.log(`${CYAN}[${getTimestamp()}]${RESET} ${GREEN}[INFO]${RESET} ${BOLD}[${tag}]${RESET} ${msg}`, ...args);
  },
  warn: (tag, msg, ...args) => {
    console.warn(`${CYAN}[${getTimestamp()}]${RESET} ${YELLOW}[WARN]${RESET} ${BOLD}[${tag}]${RESET} ${msg}`, ...args);
  },
  error: (tag, msg, ...args) => {
    console.error(`${CYAN}[${getTimestamp()}]${RESET} ${RED}[ERROR]${RESET} ${BOLD}[${tag}]${RESET} ${msg}`, ...args);
  },
  mqtt: (tag, msg, ...args) => {
    console.log(`${CYAN}[${getTimestamp()}]${RESET} ${MAGENTA}[MQTT]${RESET} ${BOLD}[${tag}]${RESET} ${msg}`, ...args);
  },
  socket: (tag, msg, ...args) => {
    console.log(`${CYAN}[${getTimestamp()}]${RESET} ${YELLOW}[SOCKET]${RESET} ${BOLD}[${tag}]${RESET} ${msg}`, ...args);
  },
};

module.exports = logger;
