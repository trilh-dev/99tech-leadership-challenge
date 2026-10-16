import { Router } from 'express';
import { z } from 'zod';
import { createDeposit } from '../services/depositService';

export const depositsRouter = Router();

const createDepositBody = z.object({
  memberId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string'),
  turnoverMultiplier: z.number().int().min(0).default(1),
});

depositsRouter.post('/', async (req, res, next) => {
  try {
    const body = createDepositBody.parse(req.body);
    const result = await createDeposit(body.memberId, body.amount, body.turnoverMultiplier);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
