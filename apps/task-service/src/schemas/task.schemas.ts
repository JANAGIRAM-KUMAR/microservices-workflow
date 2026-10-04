import {z} from 'zod';

export const createTaskSchema = z.object({
    title : z.string().min(5, "Title must be at least 5 characters long"),
});

export const updateTaskSchema = z.object({
    title : z.string().min(5, "Title must be at least 5 characters long"),
    status : z.enum(["pending", "in_progress", "completed"]),
});

export type CreateTaskSchema = z.infer<typeof createTaskSchema>;
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;