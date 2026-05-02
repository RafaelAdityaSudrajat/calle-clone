import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { createCategory } from './category.controller';

const router = Router();

router.post('/', authenticate, createCategory);

export default router;