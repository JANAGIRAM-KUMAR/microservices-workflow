import { AppError } from "shared";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {randomUUID} from 'node:crypto';
function getClientInfo(){
    const endPoint = process.env.AWS_ENDPOINT_URL_S3;
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;

    if(!endPoint || !accessKey || !secretKey || !region){
        throw new AppError(400, "AWS credentials are not configured");
    }
    return new S3Client({
        endpoint: endPoint,
        region: region,
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        },
        forcePathStyle: true
    });
}

export async function uploadBuffer(
    buffer: Buffer,
    contentType = 'image/jpeg',
) : Promise<{imageUrl : string, publicId : string}>{
    const bucket = process.env.STORAGE_BUCKET;
    const endPoint = process.env.AWS_ENDPOINT_URL_S3;

    if(!bucket || !endPoint){
        throw new AppError(400, "AWS credentials are not configured, missing STORAGE_BUCKET or AWS_ENDPOINT_URL_S3");
    }

    const Key = `support-tasks/${randomUUID()}`;


    await getClientInfo().send(
        new PutObjectCommand({
            Bucket : bucket,
            Key,
            Body : buffer,
            ContentType : contentType
        })
    )


    const baseUrl = endPoint.endsWith('/') ? endPoint.slice(0, -1) : endPoint;
    return {
        imageUrl : `${baseUrl}/${bucket}/${Key}`,
        publicId : Key
    };

}