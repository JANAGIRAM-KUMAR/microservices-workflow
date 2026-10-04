import {config} from 'dotenv'
import express from 'express'
import { resolve } from 'node:path';
import {successResponse, AppError, errorHandler, logger, httpLogger, requireGatewaySecret} from 'shared';
import authRoutes from './routes/auth.routes';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.AUTH_PORT || 5010;

const app = express();

app.use(express.json());

app.use(httpLogger);

app.get('/health', (_req, res) => {
    successResponse(res, {service: 'auth-service'});
});

app.use('/auth', requireGatewaySecret, authRoutes);

app.use((_req, _res, next) => {
    next(new AppError(404, 'Route not found'));
});

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Server is running on port http://localhost:${PORT}`);
});


