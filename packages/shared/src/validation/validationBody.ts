import { ZodSchema } from "zod/v3";
import { Request, Response, NextFunction } from 'express';
import { AppError } from "../errors/AppError";
export function validateBody(schema : ZodSchema){
    return (req : Request, res : Response, next : NextFunction) => {
        const result = schema.safeParse(req.body);
        if(!result.success){
            const msg = result.error.issues.map(issue => issue.message).join(', ');
            return next(new AppError(400, msg));
        }
        req.body = result.data;
        next();
    }
}