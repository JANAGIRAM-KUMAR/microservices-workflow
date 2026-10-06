import {config} from 'dotenv'
import { resolve } from 'node:path';
import {logger} from 'shared';
import app from './app';
import { initKafka } from './kafka';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.TASK_PORT || 5011;

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
