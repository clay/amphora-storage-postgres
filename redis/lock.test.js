'use strict';

const lockModule = require('./lock'),
  REDIS_CLIENT = {
    getAsync: jest.fn().mockResolvedValue(),
    setAsync: jest.fn().mockResolvedValue(),
    expire: jest.fn()
  },
  fakeGenericErrorLog = jest.fn(),
  fakeLog = jest.fn(),
  fakeRedlockInstance = {
    lock: jest.fn().mockResolvedValue(),
    unlock: jest.fn().mockResolvedValue()
  },
  redlockModule = jest.genMockFromModule('redlock'),
  bluebird = require('bluebird');

bluebird.delay = jest.fn().mockResolvedValue();

describe('redis/lock', () => {
  beforeEach(() => {
    lockModule.stubActionRetryTotal(5);
    lockModule.stubLogGenericError(fakeGenericErrorLog);
    lockModule.stubLog(fakeLog);
    lockModule.redlock = fakeRedlockInstance;
    lockModule.redis = REDIS_CLIENT;
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

      return lockModule.getState(key)
        .then(() =>
          expect(REDIS_CLIENT.getAsync).toBeCalledWith(key));
    });
  });

  describe('setState', () => {
    const key = 'some/key',
      value = 'some/value',
      ttl = 2000;

    test('It should call redis setAsync', () => {
      return lockModule.setState(key, value)
        .then(() =>
          expect(REDIS_CLIENT.setAsync).toBeCalledWith(key, value));
    });

    test('It should call redis expire if a TTL is passed', () => {
      return lockModule.setState(key, value, ttl)
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
      return lockModule.removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(() => expect(somePromise).toBeCalled());
    });

    test('Redis unlock is called if callback succeeds', () => {
      return lockModule.removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(() => expect(lockModule.redlock.unlock).toBeCalled());
    });

    test('Redis unlock is not called if callback fails', () => {
      somePromise = jest.fn().mockRejectedValue();

      return lockModule.removeLockWhenReady(fakeLock, lockName, somePromise)
        .catch(() => expect(lockModule.redlock.unlock).not.toBeCalled());
    });

    test('Lock release is logged if unlock succeeds', () => {
      return lockModule.removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(() =>
          expect(fakeLog).toBeCalledWith(
            'trace',
            `Releasing lock for resource id ${lockName}`,
            { lockName, processId: process.pid }
          ));
    });

    test('Returns whatever the callback returns', () => {
      return lockModule.removeLockWhenReady(fakeLock, lockName, somePromise)
        .then(result => expect(result).toBe(promiseReturnValue));
    });
  });

  describe('addLock', () => {
    const lockName = 'some-name',
      ttl = 2000;

    test('Should call redlock.lock', () => {
      lockModule.redlock.lock.mockResolvedValue();

      return lockModule.addLock(lockName, ttl).then(() => {
        expect(lockModule.redlock.lock).toBeCalledWith(lockName, ttl);
      });
    });

    test('Message is logged when addLock is called', () => {
      return lockModule.addLock(lockName, ttl).then(() =>
        expect(fakeLog).toBeCalledWith(
          'trace',
          `Trying to lock redis for resource id ${lockName}`,
          { lockName, processId: process.pid }
        ));
    });
  });

  describe('retryLocking', () => {
    const action = 'some-action',
      callback = jest.fn().mockResolvedValue();

    test('Sets the state to RETRY if the retries are not over', () => {
      return lockModule.retryLocking(action, callback).then(() => {
        expect(REDIS_CLIENT.setAsync.mock.calls[0][1]).toBe('RETRY');
      });
    });

    test('Sets the state to FINISHED if the retries are over', () => {
      lockModule.stubActionRetryTotal(2);
      return lockModule.retryLocking(action, callback).then(() => {
        expect(REDIS_CLIENT.setAsync.mock.calls[0][1]).toBe('FINISHED');
      });
    });
  });

  describe('lockAndExecute', () => {
    const action = 'some-action',
      lockName = 'some-action-lock',
      somePromise = jest.fn().mockResolvedValue();

    test('Sets the state to ongoing', () => {
      return lockModule.lockAndExecute(action, lockName, somePromise).then(() => {
        expect(REDIS_CLIENT.setAsync.mock.calls[0][1]).toBe('ON-GOING');
      });
    });

    test('Adds the lock', () => {
      return lockModule.lockAndExecute(action, lockName, somePromise).then(() => {
        expect(fakeRedlockInstance.lock.mock.calls[0][0]).toBe(lockName);
      });
    });

    test('Removes the lock', () => {
      const someLock = { name: 'lock-name' };

      fakeRedlockInstance.lock.mockResolvedValue(someLock);
      return lockModule.lockAndExecute(action, lockName, somePromise).then(() => {
        expect(fakeRedlockInstance.unlock.mock.calls[0][0]).toBe(someLock);
      });
    });

    test('Sets the stage to finished with a TTL if everything succeeds', () => {
      return lockModule.lockAndExecute(action, lockName, somePromise).then(() => {
        expect(REDIS_CLIENT.setAsync.mock.calls[1][1]).toBe('FINISHED');
      });
    });
  });

  describe('applyLock', () => {
    const action = 'some-action',
      callback = jest.fn().mockResolvedValue();

    test('When state is ONGOING, it should call delay', () => {
      REDIS_CLIENT.getAsync.mockResolvedValueOnce('ON-GOING');
      REDIS_CLIENT.getAsync.mockResolvedValueOnce('FINISHED');

      return lockModule.applyLock(action, callback).then(() => {
        expect(bluebird.delay).toBeCalledWith(1500);
      });
    });

    test.each([undefined, 'RETRY'])('It should call retryLocking when state is %s and lockAndExecute fails', state => {
      REDIS_CLIENT.getAsync.mockResolvedValueOnce(state);
      REDIS_CLIENT.setAsync.mockRejectedValue('Not found');

      return lockModule.applyLock(action, callback).catch(() => {
        expect(REDIS_CLIENT.setAsync).toBeCalledWith(action, 'RETRY');
      });
    });

    test('It should not run anything if the state has an unknown value', () => {
      REDIS_CLIENT.getAsync.mockResolvedValueOnce('some-random-state');

      return lockModule.applyLock(action, callback).then(() => {
        expect(REDIS_CLIENT.setAsync).not.toBeCalled();
        expect(REDIS_CLIENT.getAsync).toBeCalledTimes(1);
      });
    });
  });
});
