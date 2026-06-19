import type { Request, Response } from 'express';
import app from '../server/index.js';

export default function handler(req: Request, res: Response) {
  const path = typeof req.query.path === 'string' ? req.query.path : '';
  req.url = `/api/${path}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return app(req, res);
}
