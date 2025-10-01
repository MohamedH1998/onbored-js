// Jest globals declaration
declare global {
  const jest: typeof import('jest');
  const beforeEach: typeof import('@jest/globals').beforeEach;
  const afterEach: typeof import('@jest/globals').afterEach;
  const afterAll: typeof import('@jest/globals').afterAll;
  const beforeAll: typeof import('@jest/globals').beforeAll;
  const expect: typeof import('@jest/globals').expect;
  const describe: typeof import('@jest/globals').describe;
  const it: typeof import('@jest/globals').it;
  const test: typeof import('@jest/globals').test;
}

export {};
