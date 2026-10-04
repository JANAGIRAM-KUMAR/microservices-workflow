import { AppError } from "shared";
import { createUser, findByEmail, findById } from "../repositories/user.repository";
import { LoginInput, RegisterInput } from "../schemas/auth.schema";
import bcrypt from "bcryptjs";
import { convertToPublicUser } from "../utils/auth.utils";
import { signToken } from "shared";

export async function register(input: RegisterInput) {
    const existing = await findByEmail(input.email);
    if(existing){
        throw new AppError(400,'User already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user =  await createUser({name: input.name, email: input.email, passwordHash});

    return convertToPublicUser(user);
}

export async function login(input: LoginInput) {
    const user = await findByEmail(input.email);
    if(!user){
        throw new AppError(400,'User not found');
    }
    const isValid = await bcrypt.compare(input.password, user.password_hash);
    if(!isValid){
        throw new AppError(400,'Invalid password');
    }
    const token = signToken({userId : user.id, role: user.role});
    return {
        token, user: convertToPublicUser(user) 
    };
}

export async function getMe(userId : string){
    const user = await findById(userId);
    if(!user){
        throw new AppError(404, "User not found")
    }

    return convertToPublicUser(user);
}