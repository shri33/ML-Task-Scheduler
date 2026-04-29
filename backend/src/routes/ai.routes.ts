import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { authenticate } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

/**
 * POST /api/ai/chat
 * Send a message to the AI assistant
 */
router.post('/chat', aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const response = await aiService.chat(message, history || []);
    
    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/generate-scenario
 * Generate synthetic tasks for a specific scenario
 */
router.post('/generate-scenario', aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ success: false, error: 'Scenario description is required' });
    }

    const tasks = await aiService.generateScenario(description);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
});

export default router;
