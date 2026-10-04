import {config} from 'dotenv'
import express from 'express'
import { resolve } from 'node:path';
import {successResponse, AppError, errorHandler, logger, httpLogger, requireGatewaySecret} from 'shared';
import taskRoutes from './routes/task.routes';
import { initKafka } from './kafka';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.TASK_PORT || 5011;

const app = express();

app.use(express.json());

app.use(httpLogger);

app.get('/health', (_req, res) => {
    successResponse(res, {service: 'task-service'});
});

// TODO mount task routes in here
app.use('/tasks', requireGatewaySecret, taskRoutes);


app.use((_req, _res, next) => {
    next(new AppError(404, 'Route not found'));
});

app.use(errorHandler);

async function initStartUp(){
    try {
        await initKafka();
    } catch (err) {
        logger.error(err, 'kafka producer initialization failed');
    }

    app.listen(PORT, () => {
        logger.info(`Server is running on port http://localhost:${PORT}`);
    });
}

initStartUp();


