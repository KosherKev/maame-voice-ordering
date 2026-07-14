import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { createSessionStorage, getSessionStorage, deleteSessionStorage } from './storage.js';
import { harnessService } from './harnessService.js';
import { NotFoundError } from '../../src/errors/index.js';
import path from 'path';

export const voiceHarnessRouter = Router();

// Validate multipart audio uploads
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Basic validation; real validation happens via magic bytes if necessary, but this is a dev tool.
    if (file.mimetype === 'audio/wav' || file.mimetype === 'audio/webm' || file.mimetype === 'audio/mp4' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  }
});

// GET /client - serve the client HTML
voiceHarnessRouter.get('/client', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'tools/voice-harness/client/index.html'));
});

voiceHarnessRouter.post('/sessions', async (req: Request, res: Response) => {
  const { language = 'tw' } = req.body;
  const sessionId = crypto.randomUUID();
  const session = await createSessionStorage(sessionId, language);
  res.status(201).json({
    sessionId: session.sessionId,
    language: session.language,
    createdAt: session.createdAt
  });
});

voiceHarnessRouter.post('/sessions/:sessionId/turns', upload.single('audio'), async (req: Request, res: Response, next) => {
  try {
    const { sessionId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ type: 'validation-error', title: 'Validation error', detail: 'Missing audio file' });
    }

    // Process the turn using harnessService
    const turnResponse = await harnessService.processTurn(sessionId, file.path);
    res.status(200).json(turnResponse);
  } catch (err) {
    next(err);
  }
});

voiceHarnessRouter.get('/sessions/:sessionId', async (req: Request, res: Response, next) => {
  try {
    const { sessionId } = req.params;
    const session = await getSessionStorage(sessionId);
    
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }

    res.status(200).json({
      sessionId: session.sessionId,
      language: session.language,
      orderState: session.orderState,
      turns: session.turns,
      createdAt: session.createdAt
    });
  } catch (err) {
    next(err);
  }
});

voiceHarnessRouter.delete('/sessions/:sessionId', async (req: Request, res: Response, next) => {
  try {
    const { sessionId } = req.params;
    const success = await deleteSessionStorage(sessionId);
    
    if (!success) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }
    
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
