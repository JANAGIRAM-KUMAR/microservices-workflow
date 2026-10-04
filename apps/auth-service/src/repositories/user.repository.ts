import { getPool } from "shared";
import {  User } from "../types/auth.types";

export async function findByEmail(email: string): Promise<User | null> {
    const result = await getPool().query<User>(`
        SELECT id, name, email, role, password_hash, created_at
        FROM users
        WHERE email = $1
    `, [email]);
    return result.rows[0] || null;
}

export async function createUser(input: {name: string, email: string, passwordHash: string}): Promise<User> {
    const result = await getPool().query<User>(`
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, role, password_hash, created_at
    `, [input.name, input.email, input.passwordHash]);
    return result.rows[0];
}

export async function findById(id : string): Promise<User | null> {
    const result = await getPool().query<User>(`
        SELECT id, name, email, role, password_hash, created_at
        FROM users
        WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
}
