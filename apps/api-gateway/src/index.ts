import {config} from 'dotenv'
import { resolve } from 'node:path';
import {logger} from 'shared';
import app from './app';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.API_GATEWAY_PORT || 5009;

app.listen(PORT, () => {
    logger.info(`API Gateway running on port http://localhost:${PORT}`);
});
