import {config} from 'dotenv'
import { resolve } from 'node:path';
import {logger} from 'shared';
import app from './app';

config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});

const PORT = process.env.AUTH_PORT || 5010;

app.listen(PORT, () => {
    logger.info(`Server is running on port http://localhost:${PORT}`);
});
