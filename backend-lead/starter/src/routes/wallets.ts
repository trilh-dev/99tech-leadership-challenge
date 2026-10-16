import { Router } from 'express';
import { z } from 'zod';
import { createWager } from '../services/wagerService';

export const walletsRouter = Router();

const createWagerBody = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

walletsRouter.post('/:walletId/wagers', async (req, res, next) => {
  try {
    const body = createWagerBody.parse(req.body);
    const result = await createWager(req.params.walletId, body.amount);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
