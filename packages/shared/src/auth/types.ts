export type UserRole = 'user' | 'admin';

export type JWTPayload = {
    userId: string;
    role: UserRole;
};