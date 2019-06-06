'use strict';

// module.exports._sleepAndRun = sleepAndRun;
// module.exports._lockAndExecute = lockAndExecute;
// module.exports._retryLocking = retryLocking;

const lockModule = require('./lock'),
  REDIS_CLIENT = {
    getAsync: jest.fn().mockResolvedValue(),
    setAsync: jest.fn().mockResolvedValue(),
    expire: jest.fn()
  },
  fakeGenericErrorLog = jest.fn(),
  fakeLog = jest.fn(),
  fakeRedlockInstance = {
    lock: jest.fn(),
    unlock: jest.fn()
  },
  redlockModule = jest.genMockFromModule('redlock');

describe('lock', () => {
  beforeEach(() => {
    lockModule.stubLogGenericError(fakeGenericErrorLog);
    lockModule.stubLog(fakeLog);
    lockModule.redlock = fakeRedlockInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setupRedlock', () => {
    test('Returns redlock instance', () => {
      lockModule.stubRedlockModule(redlockModule);

      const redlockClient = lockModule.setupRedlock(REDIS_CLIENT);

      expect(redlockClient).toBeInstanceOf(redlockModule);
      expect(redlockClient.on).toHaveBeenCalledWith('clientError', fakeGenericErrorLog);
    });
  });

  describe('getState', () => {
    test('It should call redis getAsync', () => {
      const key = 'some/key';

      return lockModule._getState(key)
        .then(() =>
          expect(REDIS_CLIENT.getAsync).toBeCalledWith(key));
    });
  });

  describe('setState', () => {
    const key = 'some/key',
      value = 'some/value',
      ttl = 2000;

    test('It should call redis setAsync', () => {
      return lockModule._setState(key, value)
        .then(() =>
          expect(REDIS_CLIENT.setAsync).toBeCalledWith(key, value));
    });

    test('It should call redis expire if a TTL is passed', () => {
      return lockModule._setState(key, value, ttl)
        .then(() => {
          expect(REDIS_CLIENT.setAsync).toBeCalledWith(key, value);
          expect(REDIS_CLIENT.expire).toBeCalledWith(key, ttl);
        });
    });
  });

  describe('removeLockWhenReady', () => {
    const lockName = 'someName',
      fakeLock = {},
      promiseReturnValue = 'some/value';

    let somePromise;

    beforeEach(() => {
      somePromise = jest.fn().mockResolvedValue(promiseReturnValue);
      lockModule.redlock.unlock.mockResolvedValue();
    });

    test('Callback is called', () => {
      return lockModule._removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(() => expect(somePromise).toBeCalled());
    });

    test('Redis unlock is called if callback succeeds', () => {
      return lockModule._removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(() => expect(lockModule.redlock.unlock).toBeCalled());
    });

    test('Redis unlock is not called if callback fails', () => {
      somePromise = jest.fn().mockRejectedValue();

      return lockModule._removeLockWhenReady(fakeLock, lockName, somePromise)
        .catch(() => expect(lockModule.redlock.unlock).not.toBeCalled());
    });

    test('Lock release is logged if unlock succeeds', () => {
      return lockModule._removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(() =>
          expect(fakeLog).toBeCalledWith(
            'trace',
            `Releasing lock for resource id ${lockName}`,
            { lockName, processId: process.pid }
          ));
    });

    test('Returns whatever the callback returns', () => {
      return lockModule._removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(result => expect(result).toBe(promiseReturnValue));
    });
  });

  describe('addLock', () => {
    const lockName = 'some-name',
      ttl = 2000;

    test('Should call redlock.lock', () => {
      lockModule.redlock.lock.mockResolvedValue();

      return lockModule._addLock(lockName, ttl).then(() => {
        expect(lockModule.redlock.lock).toBeCalledWith(lockName, ttl);
      });
    });

    test('Message is logged when addLock is called', () => {
      return lockModule._addLock(lockName, ttl).then(() =>
        expect(fakeLog).toBeCalledWith(
          'trace',
          `Trying to lock redis for resource id ${lockName}`,
          { lockName, processId: process.pid }
        ));
    });
  });

  describe('sleepAndRun', () => {
    test('Callback is called', () => {
      const somePromise = jest.fn().mockResolvedValue('value');

      return lockModule._sleepAndRun(somePromise, 250).then(() => {
        expect(somePromise).toBeCalled();
      });
    });
  });
});
