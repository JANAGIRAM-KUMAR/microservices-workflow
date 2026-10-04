import {config} from 'dotenv'
import { resolve } from 'node:path';
import express from 'express';
// cors does not ship TypeScript declarations in this project.
// @ts-expect-error: use the runtime package until its type declarations are installed.
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { MINUTE } from 'express-rate-limit';
import { AppError, errorHandler, httpLogger, logger, successResponse } from 'shared';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { gatewayAuth } from './middleware/gatewayAuth';


config({path: resolve(process.cwd(), '.env')});
config({path: resolve(process.cwd(), '../../.env')});


const PORT = process.env.API_GATEWAY_PORT || 5009;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5010';
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:5011';
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:5012';
const WORKFLOW_SERVICE_URL = process.env.WORKFLOW_SERVICE_URL || 'http://localhost:5013';

const app = express();

app.use(helmet()); // Secure default http headers
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}))
app.use(httpLogger);

app.get('/health', (_req, res) => {
    successResponse(res, {service: 'api-gateway'});
});

// Create Proxy

// Auth proxy http://localhost:5009/auth/* will be forwarded to http://localhost:5010/auth/*

const taskProxy = createProxyMiddleware({
    target: TASK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/tasks${path}`,
});

const mediaProxy = createProxyMiddleware({
    target: MEDIA_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/tasks${path}`,
});

const workflowProxy = createProxyMiddleware({
    target: WORKFLOW_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/tasks${path}`,
});

app.use('/auth', gatewayAuth ,
    
    createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/auth${path}`,
}));

app.use('/tasks', gatewayAuth, (req, res, next) => {

    logger.info(`Gateway task request: ${req.method} ${req.path}`);

    if (req.path.includes('/attachments')) {
        logger.info('Routing to MEDIA SERVICE');
        return mediaProxy(req, res, next);
    }

    if (req.path.includes('/workflows')) {
        logger.info('Routing to WORKFLOW SERVICE');
        return workflowProxy(req, res, next);
    }

    logger.info('Routing to TASK SERVICE');
    return taskProxy(req, res, next);
});


app.use((_req, _res, next) => {
    next(new AppError(404, 'Route not found'));

});

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway running on port http://localhost:${PORT}`);
});