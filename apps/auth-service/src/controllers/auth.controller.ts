import {Request, Response, NextFunction} from 'express';
import * as authService from '../services/auth.service';
import { AppError, successResponse } from 'shared';

export async function register(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try{
        const user = await authService.register(req.body);
        successResponse(res,{user},201);
    } catch (err){
        next(err);
    }
}

export async function login(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try{
        const user = await authService.login(req.body);
        successResponse(res,{user},200);
    } catch (err){
        next(err);
    }
}


export async function getMe(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try{
        const userId = req.header("x-user-id");
        if(!userId){
            throw new AppError(401, "Missing x-user-id header");
        }
        const user = await authService.getMe(userId);
        successResponse(res, {user});
    } catch (err){
        next(err);
    }
}

