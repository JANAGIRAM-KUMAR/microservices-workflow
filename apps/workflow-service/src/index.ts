import {config} from 'dotenv'
import { resolve } from 'node:path';
import {logger} from 'shared';
import app from './app';
import { startKafka } from './services/workflow.service';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.WORKFLOW_PORT || 5013;

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
