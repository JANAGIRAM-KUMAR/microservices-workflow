import {Router} from 'express';
import { validateBody } from 'shared';
import { createTaskSchema, updateTaskSchema } from '../schemas/task.schemas';
import * as taskController from '../controllers/task.controller';

const router = Router();

router.post("/", validateBody(createTaskSchema as any), taskController.createTask);
router.get("/", taskController.listTasks);
router.get("/:id", taskController.findTaskById);
router.put("/:id", validateBody(updateTaskSchema as any), taskController.updateTask);
router.delete("/:id", taskController.deleteTaskById);

export default router;