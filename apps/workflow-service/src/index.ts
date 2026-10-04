import {config} from 'dotenv'
import express from 'express'
import { resolve } from 'node:path';
import { AppError, errorHandler, httpLogger, logger, requireGatewaySecret, successResponse } from 'shared';
import { startKafka } from './services/workflow.service';
import workflowRoutes from './routes/workflow.route';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.WORKFLOW_PORT || 5013;

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

async function initStartUp(){
    try {
        await startKafka();
    } catch (err) {
        logger.error(err, 'kafka consumer initialization failed');
    }

    app.listen(PORT, () => {
        logger.info(`Workflow Service running on port http://localhost:${PORT}`);
    });
}

initStartUp();


