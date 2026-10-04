import {Router} from 'express';
import { validateBody } from 'shared';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/register', validateBody(registerSchema as any), authController.register);
router.post('/login', validateBody(loginSchema as any), authController.login);
router.get('/me', authController.getMe);



export default router;