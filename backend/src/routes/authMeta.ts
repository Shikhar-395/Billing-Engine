import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';

const router = Router();

router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
  });
});

export default router;
