import { getPool } from "shared";
import { Task, TaskStatus } from "../types/task.types";


export async function createTask(input : {
    title : string, createdBy : string
}) : Promise<Task> {
    const result = await getPool().query<Task>(
        `INSERT INTO tasks (title, created_by)
        VALUES ($1, $2)
        RETURNING id, title, status, created_by, created_at, updated_at`,
        [input.title, input.createdBy]  
    );

    return result.rows[0];
}


export async function listTasks (input : {
    userId : string, role : string
}) : Promise<Task[]> {

    if(input.role === 'admin'){
        const result = await getPool().query<Task>(`
            SELECT id, title, status, created_by, created_at, updated_at
            FROM tasks
            ORDER BY created_at DESC
        `);
        return result.rows;
    }

    const result = await getPool().query<Task>(`
        SELECT id, title, status, created_by, created_at, updated_at
        FROM tasks
        WHERE created_by = $1
        ORDER BY created_at DESC
    `, [input.userId]);
    return result.rows;
}

export async function findTaskById(id : string) : Promise<Task | null> {
    const result = await getPool().query<Task>(`
        SELECT id, title, status, created_by, created_at, updated_at
        FROM tasks
        WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
}

export async function updateTask(id : string, input : {
    title : string, status : TaskStatus
}) : Promise<Task> {
    const result = await getPool().query<Task>(`
        UPDATE tasks
        SET title = $1, status = $2
        WHERE id = $3
        RETURNING id, title, status, created_by, created_at, updated_at
    `, [input.title, input.status, id]);
    return result.rows[0];
}

export async function deleteTaskById(id : string) : Promise<boolean> {
    const result = await getPool().query<Task>(`
        DELETE FROM tasks
        WHERE id = $1
    `, [id]);
    return (result.rowCount ?? 0) > 0;
}

