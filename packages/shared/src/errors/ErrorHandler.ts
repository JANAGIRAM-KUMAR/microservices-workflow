import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
export function errorHandler (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {

    if(err instanceof AppError){
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
        return;
    }
    // Logger needs to be added
    res.status(500).json({
        success: false,
        error: "Internal Server Error",
    });
}