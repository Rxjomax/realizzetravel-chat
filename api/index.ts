import { createExpressApp, ensureDbReady } from '../server/app';

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    appInstance = createExpressApp();
  }
  return appInstance;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureDbReady();
  } catch (err: any) {
    console.error('ensureDbReady handler error:', err);
  }
  const app = getApp();
  return app(req, res);
}
