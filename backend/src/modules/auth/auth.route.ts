import { Router } from 'express';
import { register, login , getMe, logout} from './auth.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;