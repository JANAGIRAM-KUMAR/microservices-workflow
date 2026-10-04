import multer from 'multer';
import { AppError } from 'shared';

export const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB 
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new AppError(400,'Only image files are allowed'));
            return;
        } 

        cb(null, true);
    }
}).single('image'); // field name used when calling this api from postman

