import { Router } from 'express';
import { z } from 'zod';
import { handlePspCallback } from '../services/depositService';

export const pspRouter = Router();

const pspCallbackBody = z.object({
  pspRef: z.string(),
  status: z.enum(['completed', 'failed']),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

pspRouter.post('/callbacks', async (req, res, next) => {
  try {
    const body = pspCallbackBody.parse(req.body);
    const result = await handlePspCallback(body.pspRef, body.status, body.amount);
    res.json(result);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
