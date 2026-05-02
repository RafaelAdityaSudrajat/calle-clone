"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProductSchema = void 0;
const zod_1 = require("zod");
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, 'Name must be at least 3 characters'),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive('Price must be positive'),
    stock: zod_1.z.number().int().nonnegative('Stock must be non-negative'),
    categoryId: zod_1.z.string().uuid('Invalid category ID'),
    variants: zod_1.z.array(zod_1.z.object({
        size: zod_1.z.string().min(1, 'Size is required'),
        color: zod_1.z.string().min(1, 'Color is required'),
        stock: zod_1.z.number().int().nonnegative('Stock must be non-negative'),
        price: zod_1.z.number().positive('Price must be positive').optional(),
    })).optional(),
});
