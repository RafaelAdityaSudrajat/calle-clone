"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = void 0;
const category_validation_1 = require("./category.validation");
const category_service_1 = require("./category.service");
const errors_1 = require("../../lib/errors");
const createCategory = async (req, res, next) => {
    try {
        const parsed = category_validation_1.createCategorySchema.safeParse(req.body);
        if (!parsed.success) {
            const message = parsed.error.errors[0].message;
            throw new errors_1.ValidationError(message);
        }
        const result = await (0, category_service_1.createCategoryService)(parsed.data);
        res.status(201).json({
            status: 'success',
            message: 'Category created successfully',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createCategory = createCategory;
