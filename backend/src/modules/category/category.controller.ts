import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authenticate';
import { createCategorySchema } from './category.validation';
import { createCategoryService } from './category.service';
import { ValidationError } from '../../lib/errors';

export const createCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.errors[0].message;
      throw new ValidationError(message);
    }

    const result = await createCategoryService(parsed.data);

    res.status(201).json({
      status: 'success',
      message: 'Category created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};