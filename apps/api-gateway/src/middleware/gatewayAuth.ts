import type {Request, Response, NextFunction} from 'express';
import { AppError, verifyToken } from 'shared';
import { getAllowedRules, isPublicRoute } from '../rbac';

// Run on every auth request before proxy forwardto auth service

const IDENTITY_HEADERS = ['x-user-id', 'x-user-role','x-gateway-secret'] as const;

function stripIdentityHeaders(req: Request) {
    for(const header of IDENTITY_HEADERS){
        delete req.headers[header];
    }
}

function attachGatewaySecret(req: Request) {
    const secret = process.env.GATEWAY_SECRET;
    if(!secret){
        throw new AppError(500, "GATEWAY_SECRET is not configured");
    }
    req.headers['x-gateway-secret'] = secret;
}

function requestPath(req: Request) {
    const combined = `${req.baseUrl}${req.path}`;
    if(combined.length > 1 && combined.endsWith('/')){
        return combined.slice(0, -1);
    }
    return combined || '/';
}

function attachUserHeaders(req: Request, userId : string, userRole : string) {
    req.headers['x-user-id'] = userId;
    req.headers['x-user-role'] = userRole;
}

export function gatewayAuth(req : Request, res : Response, next : NextFunction) {
    try {
        // strip / remove identity headers
        stripIdentityHeaders(req);
        attachGatewaySecret(req);

        const path = requestPath(req);
        if(isPublicRoute(req.method, path)){
            return next();
        }

        const authHeader = req.header("authorization");
        if(!authHeader?.startsWith("Bearer ")){
            throw new AppError(401, "Missing authorization header");
        }

        const token = authHeader.slice("Bearer ".length).trim();
        const payload = verifyToken(token);

        // RBAC check
        const allowedRoles = getAllowedRules(req.method, path);
        if(allowedRoles.length === 0){
            throw new AppError(404, 'Route not found');
        }
        if(!allowedRoles.includes(payload.role)){
            throw new AppError(403, "Forbidden, you don't have access to this route");
        }

        attachUserHeaders(req, payload.userId, payload.role);
        next();
    } catch (err) {
        if(err instanceof AppError){
            return next(err);
        }
        // Generic error if the jwt verification fails
        return next(new AppError(401, "Invalid or expired token"));
    }
    
}