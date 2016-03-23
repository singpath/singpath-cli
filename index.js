'use strict';

const argparse = require('argparse');
const camelCase = require('lodash.camelcase');
const fs = require('fs');

const chainKey = Symbol('chain');

class Settings {

  constructor(defaults) {
    Object.assign(this, defaults);
    this[chainKey] = Promise.resolve(this);
  }

  done() {
    return this[chainKey];
  }

  /**
   * Update seetings with environment variables.
   *
   *  options:
   *
   *  - filter: a function filtering keys. Take the key as argument and must
   *    return true if the key should included (optional);
   *  - include: array of key to include (optional);
   *  - exclude: array of key to exclude (optional).
   *
   * @param  {string}  prefix
   * @param  {object}  opts
   * @return {this}
   */
  env(prefix, opts) {
    prefix = prefix || '';
    opts = opts || {};

    this[chainKey] = this[chainKey].then(() => {
      const env = opts.env || process.env;
      const prefixLength = prefix.length;

      const vars = entries(env).filter(
        entrie => entrie[0].startsWith(prefix)
      );

      opts.transform = (entrie) => ([
        camelCase(entrie[0].slice(prefixLength)),
        entrie[1]
      ]);

      return this._update(vars, opts);
    });

    return this;
  }

  /**
   * Update settings with json encoded settings from a file.
   *
   * options:
   * - transform: function transforming the key and value of each item in the
   *   json file (optional);
   * - filter: a function filtering keys. Take the key as argument and must
   *   return true if the key should included (optional);
   * - include: array of key to include (optional);
   * - exclude: array of key to exclude (optional).
   *
   * @param  {string} path
   * @param  {object} opts
   * @return {this}
   */
  json(path, opts) {
    this[chainKey] = this[chainKey].then(
      () => readJsonFile(path)
    ).then(
      settings => this._update(entries(settings), opts)
    );

    return this;
  }

  /**
   * Update setting using a argparse parser.
   *
   * options:
   * - version;
   * - descriptions;
   * - epilog;
   * - cmd: the cli main command (either cmd or subCmds can be defined)
   * - subCmds: array of subCmd object (each define a name, a description, an
   *   options function and cmd function).
   * - options: function extending parsers.
   * - filter: a function filtering keys. Take the key as argument and must
   *   return true if the key should included (optional);
   * - include: array of key to include (optional);
   * - exclude: array of key to exclude (optional).
   *
   * @param  {object}          opts
   * @param  {array|undefined} args uses process.argv by default
   * @return {this}
   */
  argv(opts) {
    this[chainKey] = this[chainKey].then(() => {
      const argv = opts.argv;
      const parser = parserFactory(opts, this);

      return parser.parseArgs(argv);
    }).then(settings => {
      opts.transform = (entrie) => ([
        camelCase(entrie[0]),
        entrie[1]
      ]);

      return this._update(entries(settings), opts);
    });

    return this;
  }

  update(settings, opts) {
    return this._update(entries(settings), opts);
  }

  _update(entries, opts) {
    const cfg = entries.map(
      transformFactory(opts)
    ).filter(
      filterFactory(opts)
    );

    return Object.assign(this, obj(cfg));
  }
}

function entries(obj) {
  return Object.keys(obj).map(
    k => ([k, obj[k]])
  );
}

function obj(entries) {
  return entries.reduce((obj, e) => {
    obj[e[0]] = e[1];

    return obj;
  }, {});
}

function transformFactory(opts) {
  if (opts && opts.transform) {
    return opts.transform;
  }

  return e => e;
}

function filterFactory(opts) {
  opts = opts || {};

  if (opts.filter) {
    return opts.filter;
  }

  if (opts.exclude) {
    const exclude = new Set(opts.exclude);

    return entrie => !exclude.has(entrie[0]);
  }

  if (opts.include) {
    const include = new Set(opts.include);

    return entrie => include.has(entrie[0]);
  }

  return () => true;
}

function parserFactory(opts, defaults) {
  if (!opts || !opts.cmd && (!opts.subCmds || !opts.subCmds.length)) {
    throw new Error('opts.cmd or opts.subCmds must be set.');
  }

  const parser = new argparse.ArgumentParser({
    version: opts.version || '0.0.0',
    addHelp: opts.addHelp === false ? false : true,
    description: opts.description || '',
    formatterClass: argparse.RawTextHelpFormatter,
    epilog: opts.epilog
  });

  parser.addArgument(['-d', '--debug' ], {
    action: 'storeTrue',
    help: 'print debug messages'
  });

  parser.addArgument(['-s', '--silent' ], {
    action: 'storeTrue',
    help: 'print only error messages'
  });

  if (opts.options) {
    opts.options(parser, defaults);
  }

  if (opts.cmd) {
    parser.setDefaults({cmd: opts.cmd});
    return parser;
  }

  const subparsers = parser.addSubparsers();

  opts.subCmds.forEach(sub => {
    const parser =  subparsers.addParser(sub.name, {
      addHelp: true,
      description: sub.description,
      formatterClass: argparse.RawTextHelpFormatter
    });

    parser.setDefaults({cmd: sub.cmd});
    sub.options(parser, defaults);
  });

  return parser;
}

function readJsonFile(path) {
  return readFile(path).catch(
    () => '{}'
  ).then(
    content => JSON.parse(content)
  );
}

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function writeFile(path, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, err => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function deleteFile(path) {
  return new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

exports.Settings = Settings;
exports.settings = defaults => new Settings(defaults);
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.deleteFile = deleteFile;
