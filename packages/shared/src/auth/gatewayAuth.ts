import type {Request, Response, NextFunction} from 'express';
import { AppError } from '../errors/AppError';

export function requireGatewaySecret(req : Request, res : Response, next : NextFunction) {
    const expected = process.env.GATEWAY_SECRET;
    if(!expected){
        return next(new AppError(500, "GATEWAY_SECRET is not configured"));
    }
    const secret = req.header("x-gateway-secret");
    if(!secret || secret !== expected){
        return next(new AppError(403, "Forbidden"));
    }
    next();
}