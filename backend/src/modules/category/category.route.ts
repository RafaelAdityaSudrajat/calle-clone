import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from './category.controller';

const router = Router();

router.get('/', getCategories);
router.get("/:id", getCategoryById)
router.post('/', authenticate, createCategory);
router.patch('/:id', authenticate, updateCategory);
router.delete('/:id', authenticate, deleteCategory);

export default router;