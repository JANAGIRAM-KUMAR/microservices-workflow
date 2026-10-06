import express from 'express';
import { successResponse, AppError, errorHandler, httpLogger, requireGatewaySecret } from 'shared';
import authRoutes from './routes/auth.routes';

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

export default app;
