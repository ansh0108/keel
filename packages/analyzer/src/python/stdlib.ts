// Top-level names of the Python 3 standard library. Used by the hallucinated-
// import rule to avoid flagging stdlib modules that never appear in
// requirements.txt. Kept intentionally broad (covers 3.8–3.12); a few removed
// modules linger here harmlessly since their absence only risks a false
// positive, which the manifest/local checks still guard against.
export const PY_STDLIB = new Set<string>([
  '__future__', '_thread', 'abc', 'aifc', 'argparse', 'array', 'ast', 'asyncio',
  'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'bisect', 'builtins', 'bz2',
  'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd', 'code', 'codecs',
  'codeop', 'collections', 'colorsys', 'compileall', 'concurrent', 'configparser',
  'contextlib', 'contextvars', 'copy', 'copyreg', 'cProfile', 'crypt', 'csv',
  'ctypes', 'curses', 'dataclasses', 'datetime', 'dbm', 'decimal', 'difflib',
  'dis', 'doctest', 'email', 'encodings', 'ensurepip', 'enum', 'errno',
  'faulthandler', 'fcntl', 'filecmp', 'fileinput', 'fnmatch', 'fractions',
  'ftplib', 'functools', 'gc', 'getopt', 'getpass', 'gettext', 'glob', 'graphlib',
  'grp', 'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http', 'idlelib', 'imaplib',
  'imghdr', 'imp', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
  'keyword', 'lib2to3', 'linecache', 'locale', 'logging', 'lzma', 'mailbox',
  'mailcap', 'marshal', 'math', 'mimetypes', 'mmap', 'modulefinder', 'msilib',
  'msvcrt', 'multiprocessing', 'netrc', 'nis', 'nntplib', 'numbers', 'operator',
  'optparse', 'os', 'ossaudiodev', 'pathlib', 'pdb', 'pickle', 'pickletools',
  'pipes', 'pkgutil', 'platform', 'plistlib', 'poplib', 'posix', 'pprint',
  'profile', 'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue',
  'quopri', 'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter',
  'runpy', 'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil',
  'signal', 'site', 'smtplib', 'sndhdr', 'socket', 'socketserver', 'spwd',
  'sqlite3', 'ssl', 'stat', 'statistics', 'string', 'stringprep', 'struct',
  'subprocess', 'sunau', 'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny',
  'tarfile', 'telnetlib', 'tempfile', 'termios', 'test', 'textwrap', 'threading',
  'time', 'timeit', 'tkinter', 'token', 'tokenize', 'tomllib', 'trace',
  'traceback', 'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types', 'typing',
  'unicodedata', 'unittest', 'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave',
  'weakref', 'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml',
  'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo',
])

// Import names whose PyPI distribution name differs, so a manifest listing the
// distribution still satisfies the import (e.g. `import cv2` ← `opencv-python`).
// Maps import name -> the distribution name(s) that provide it.
export const IMPORT_TO_DISTRIBUTION: Record<string, string[]> = {
  cv2: ['opencv-python', 'opencv-python-headless', 'opencv-contrib-python'],
  PIL: ['pillow'],
  sklearn: ['scikit-learn'],
  skimage: ['scikit-image'],
  yaml: ['pyyaml'],
  bs4: ['beautifulsoup4'],
  dotenv: ['python-dotenv'],
  jose: ['python-jose'],
  jwt: ['pyjwt'],
  dateutil: ['python-dateutil'],
  google: ['google-api-python-client', 'protobuf', 'google-cloud'],
  OpenSSL: ['pyopenssl'],
  serial: ['pyserial'],
  Crypto: ['pycryptodome', 'pycrypto'],
  win32api: ['pywin32'],
  win32com: ['pywin32'],
  pkg_resources: ['setuptools'],
  setuptools: ['setuptools'],
  attr: ['attrs'],
  attrs: ['attrs'],
  zmq: ['pyzmq'],
  usb: ['pyusb'],
  gi: ['pygobject'],
  cairo: ['pycairo'],
  Xlib: ['python-xlib'],
  magic: ['python-magic'],
  slugify: ['python-slugify'],
  multipart: ['python-multipart'],
  lxml: ['lxml'],
  MySQLdb: ['mysqlclient'],
  psycopg2: ['psycopg2', 'psycopg2-binary'],
  redis: ['redis'],
  grpc: ['grpcio'],
  pydantic_core: ['pydantic-core'],
  PyQt5: ['pyqt5'],
  PyQt6: ['pyqt6'],
  docx: ['python-docx'],
  pptx: ['python-pptx'],
  fitz: ['pymupdf'],
  nacl: ['pynacl'],
}

// Normalises a PyPI distribution name for comparison: lowercase, and treat
// '-', '_', '.' as equivalent separators (PEP 503).
export function normalizeDistribution(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-')
}
