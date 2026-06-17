import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { authenticate } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { validateRequest } from '../middleware/validate';
import { aiChatSchema, generateScenarioSchema } from '../validators/ai.validator';
import { successResponse } from '../lib/http/response';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

/**
 * POST /api/ai/chat
 * Send a message to the AI assistant
 */
router.post('/chat', aiLimiter, validateRequest({ body: aiChatSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history } = req.body;
    const response = await aiService.chat(message, history || []);
    
    successResponse(res, {
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/generate-scenario
 * Generate synthetic tasks for a specific scenario
 */
router.post('/generate-scenario', aiLimiter, validateRequest({ body: generateScenarioSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description } = req.body;
    const tasks = await aiService.generateScenario(description);
    
    successResponse(res, tasks);
  } catch (error) {
    next(error);
  }
});

export default router;
