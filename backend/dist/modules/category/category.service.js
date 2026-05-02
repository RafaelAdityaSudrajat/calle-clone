"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategoryService = void 0;
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const generateSlug = async (name) => {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    const existing = await prisma_1.prisma.category.findUnique({ where: { slug: base } });
    if (!existing)
        return base;
    let counter = 1;
    while (true) {
        const slug = `${base}-${counter}`;
        const found = await prisma_1.prisma.category.findUnique({ where: { slug } });
        if (!found)
            return slug;
        counter++;
    }
};
const createCategoryService = async (input) => {
    const existing = await prisma_1.prisma.category.findFirst({
        where: { name: { equals: input.name, mode: 'insensitive' } },
    });
    if (existing) {
        throw new errors_1.ConflictError('Category already exists');
    }
    const slug = await generateSlug(input.name);
    return prisma_1.prisma.category.create({
        data: { name: input.name, slug },
    });
};
exports.createCategoryService = createCategoryService;
