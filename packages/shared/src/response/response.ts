import {Response} from 'express';


export function successResponse (
    res: Response,
    data: unknown,
    statusCode = 200
) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}

export function failedResponse (
    res: Response,
    message: string,
    statusCode = 400
) {
    return res.status(statusCode).json({
        success: false,
        message,
    });
}

