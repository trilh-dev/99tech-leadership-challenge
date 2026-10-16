import { Router } from 'express';
import { z } from 'zod';
import { createWithdrawal, TurnoverError } from '../services/withdrawalService';

export const withdrawalsRouter = Router();

const createWithdrawalBody = z.object({
  memberId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

withdrawalsRouter.post('/', async (req, res, next) => {
  try {
    const body = createWithdrawalBody.parse(req.body);
    const result = await createWithdrawal(body.memberId, body.amount);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.status === 422 && err.outstandingTurnover !== undefined) {
      res.status(422).json({ error: err.message, outstandingTurnover: err.outstandingTurnover });
      return;
    }
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
