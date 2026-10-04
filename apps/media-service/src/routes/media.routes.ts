import {Router} from 'express';
import type {Request, Response, NextFunction} from 'express';
import * as mediaController from '../controllers/media.controller';
import { uploadImage } from '../middleware/upload.middleware';
import { AppError } from 'shared';

const router = Router();

function handleUpload(
    req: Request,
    res: Response,
    next: NextFunction
) {
    uploadImage(req,res,(err:unknown) => {
        if(!err){
            return next();
        }
        if(err instanceof AppError){
            return next(err);
        }
        if(typeof err === 'object' && err != null && 'code' in err && err.code === 'LIMIT_FILE_SIZE'){
            return next(new AppError(400, "Image must be less than 5MB"));
        }
        return next(new AppError(400, "Invalid image upload"));
    })
}

router.post("/:taskId/attachments", handleUpload, mediaController.uploadAttachment);
router.get("/:taskId/attachments", mediaController.listAttachments);

export default router;