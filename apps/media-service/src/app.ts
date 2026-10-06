import express from 'express';
import { successResponse, AppError, errorHandler, httpLogger, requireGatewaySecret } from 'shared';
import mediaRoutes from './routes/media.routes';

const app = express();

app.use(express.json());

app.use(httpLogger);

app.get('/health', (_req, res) => {
    successResponse(res, {service: 'media-service'});
});

app.use('/tasks', requireGatewaySecret, mediaRoutes);

app.use((_req, _res, next) => {
    next(new AppError(404, 'Route not found'));
});

app.use(errorHandler);

export default app;
