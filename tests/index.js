'use strict';

const cli = require('../');
const expect = require('expect.js');
const path = require('path');

describe('Settings', function() {
  let settings;

  beforeEach(function() {
    settings = cli.settings({foo: 1});
  });

  it('should take default values', function() {
    expect(settings).to.eql({foo: 1});
  });

  describe('update', function() {

    it('should filter entries', function() {
      const foo = 2;
      const bar = 3;

      settings.update({foo, bar}, {
        filter: entrie => entrie[1] !== 3
      });

      expect(settings.foo).to.be(foo);
      expect(settings.bar).to.be(undefined);
    });

    it('should exclude by key', function() {
      const foo = 2;
      const bar = 3;

      settings.update({foo, bar}, {
        exclude: ['bar']
      });

      expect(settings.foo).to.be(foo);
      expect(settings.bar).to.be(undefined);
    });

    it('should include by key', function() {
      const foo = 2;
      const bar = 3;
      const baz = 4;

      settings.update({foo, bar, baz}, {
        include: ['foo']
      });

      expect(settings.foo).to.be(foo);
      expect(settings.bar).to.be(undefined);
      expect(settings.baz).to.be(undefined);
    });

  });

  describe('env', function() {
    let origEnv;

    beforeEach(function() {
      origEnv = process.env;
    });

    afterEach(function() {
      process.env = origEnv;
    });

    it('should update setting en env. variables', function() {
      const prefix = 'BAR_';
      const foo = 2;
      const fooBar = 3;
      const env = {
        [`${prefix}FOO`]: foo,
        [`${prefix}FOO_BAR`]: fooBar,
        'FOO_BAR': 4
      };

      return settings.env(prefix, {env}).done().then(settings => {
        expect(settings).to.eql({foo, fooBar});
      });
    });

    it('should have "" has default prefix', function() {
      const prefix = '';
      const foo = 2;
      const fooBar = 3;
      const env = {
        [`${prefix}FOO`]: foo,
        [`${prefix}FOO_BAR`]: fooBar
      };

      return settings.env(undefined, {env}).done().then(settings => {
        expect(settings).to.eql({foo, fooBar});
      });
    });

    it('should use process.env by default', function() {
      const prefix = 'BAR_';
      const foo = 2;
      const fooBar = 3;

      process.env = {
        [`${prefix}FOO`]: foo,
        [`${prefix}FOO_BAR`]: fooBar,
        'FOO_BAR': 4
      };

      return settings.env(prefix).done().then(settings => {
        expect(settings).to.eql({foo, fooBar});
      });
    });

  });

  describe('json', function() {
    const cfgPath = path.join(__dirname, 'cfg.json');
    const notFoundPath = path.join(__dirname, 'notfound.json');
    const foo = 2;
    const fooBar = 3;

    beforeEach(function() {
      return cli.writeFile(cfgPath, JSON.stringify({foo, fooBar}));
    });

    afterEach(function() {
      return cli.deleteFile(cfgPath);
    });

    it('should update setting from json file', function() {

      return settings.json(cfgPath).done().then(settings => {
        expect(settings).to.eql({foo, fooBar});
      });
    });

    it('should skip json file update if file is missing', function() {
      return settings.json(notFoundPath).done().then(settings => {
        expect(settings).to.eql({foo: 1});
      });
    });

  });

  describe('argv', function() {

    it('should update settings from argv', function() {
      const foo = 2;
      const fooBar = '3';
      const argv = ['--foo', '' + foo, '--foo-bar', fooBar];
      const options = (parser) => {
        parser.addArgument(['-f', '--foo'], {type: 'int'});
        parser.addArgument(['-b', '--foo-bar']);
      };
      const cmd = () => undefined;
      const addHelp = false;

      return settings.argv({argv, cmd, options, addHelp}).done().then(settings => {
        expect(settings).to.eql({
          foo,
          fooBar,
          cmd,
          debug: false,
          silent: false
        });
        expect(settings.foo).to.be(2);
      });
    });

    it('should parse sub commands', function() {
      const foo = 2;
      const fooBar = '3';
      const argv = ['cmd1', '--foo', '' + foo, '--foo-bar', fooBar];
      const cmd = () => undefined;
      const subCmds = [{
        name: 'cmd1',
        options: (parser) => {
          parser.addArgument(['-f', '--foo'], {type: 'int'});
          parser.addArgument(['-b', '--foo-bar']);
        },
        cmd: cmd
      }];

      return settings.argv({argv, subCmds}).done().then(settings => {
        expect(settings).to.eql({
          foo,
          fooBar,
          cmd,
          debug: false,
          silent: false
        });
        expect(settings.foo).to.be(2);
      });
    });

    it('should reject if neither cmd or subCmds is not set', function() {
      const argv = ['cmd1', '--foo', '2', '--foo-bar', '3'];

      return settings.argv({argv}).done().then(
        () => Promise.reject(new Error('unexpected')),
        () => undefined
      ).then(
        () => expect(settings).to.eql({foo: 1})
      );
    });

  });

});
