import express from 'express';
import { AppError, errorHandler, httpLogger, requireGatewaySecret, successResponse } from 'shared';
import workflowRoutes from './routes/workflow.route';

const app = express();

app.use(express.json());

app.use(httpLogger);

app.get('/health', (_req, res) => {
    successResponse(res, {service: 'workflow-service'});
});

app.use(requireGatewaySecret, workflowRoutes);

app.use((_req, _res, next) => {
    next(new AppError(404, 'Route not found'));
});

app.use(errorHandler);

export default app;
