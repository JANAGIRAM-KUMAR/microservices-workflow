import jwt from 'jsonwebtoken';
import type { JWTPayload } from './types';

function extractjwtSecret() : string {
    const secret = process.env.JWT_SECRET as string;
    if(!secret){
        throw new Error('JWT_SECRET is not set');
    }
    return secret;
}

export function signToken(payload : JWTPayload){
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const secret = extractjwtSecret();

    if(!secret){
        throw new Error('JWT_SECRET is not set');
    }

    return jwt.sign(payload, secret, {expiresIn : expiresIn as jwt.SignOptions['expiresIn']});
}

export function verifyToken(token: string): JWTPayload {
    const secret = extractjwtSecret();

    if (!secret) {
        throw new Error('JWT_SECRET is not set, cannot verify token');
    }

    const decodedToken = jwt.verify(token, secret);

    if (
        typeof decodedToken !== 'object' ||
        decodedToken === null ||
        typeof decodedToken.userId !== 'string' ||
        (decodedToken.role !== 'user' && decodedToken.role !== 'admin')
    ) {
        throw new Error('Invalid token payload');
    }

    return {
        userId: decodedToken.userId,
        role: decodedToken.role
    };
}