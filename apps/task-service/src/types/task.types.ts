export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type Task = {
    id : string,
    title : string,
    status : TaskStatus,
    created_by : string,
    created_at : Date,
    updated_at : Date
}