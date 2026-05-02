"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProductImages = exports.createProductService = void 0;
const cloudinary_1 = __importDefault(require("../../lib/cloudinary"));
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const generateSlug = async (name) => {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    const existing = await prisma_1.prisma.product.findUnique({ where: { slug: base } });
    if (!existing)
        return base;
    let counter = 1;
    while (true) {
        const slug = `${base}-${counter}`;
        const found = await prisma_1.prisma.product.findUnique({ where: { slug } });
        if (!found)
            return slug;
        counter++;
    }
};
const createProductService = async (input) => {
    const category = await prisma_1.prisma.category.findUnique({
        where: { id: input.categoryId },
    });
    if (!category) {
        throw new errors_1.NotFoundError("Category not found");
    }
    const slug = await generateSlug(input.name);
    return prisma_1.prisma.$transaction(async (tx) => {
        return tx.product.create({
            data: {
                name: input.name,
                slug,
                description: input.description,
                price: input.price,
                stock: input.stock,
                categoryId: input.categoryId,
                variants: input.variants ? { create: input.variants } : undefined,
            },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                variants: true,
                images: true,
            },
        });
    });
};
exports.createProductService = createProductService;
const uploadProductImages = async (productId, files) => {
    const uploadPromises = files.map(async (file, index) => {
        const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        const result = await cloudinary_1.default.uploader.upload(base64, {
            folder: "products",
            transformation: [{ width: 800, height: 800, crop: "limit" }],
        });
        return prisma_1.prisma.productImage.create({
            data: {
                productId,
                url: result.secure_url,
                isPrimary: index === 0,
                order: index,
            },
        });
    });
    return Promise.all(uploadPromises);
};
exports.uploadProductImages = uploadProductImages;
