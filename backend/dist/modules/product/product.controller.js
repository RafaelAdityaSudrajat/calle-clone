"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImages = exports.createProduct = void 0;
const product_service_1 = require("./product.service");
const errors_1 = require("../../lib/errors");
const upload_1 = require("../../middlewares/upload");
const product_validation_1 = require("./product.validation");
const product_service_2 = require("./product.service");
const createProduct = async (req, res, next) => {
    try {
        const parsed = product_validation_1.createProductSchema.safeParse(req.body);
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message || "Validation error";
            throw new errors_1.ValidationError(message);
        }
        const result = await (0, product_service_2.createProductService)(parsed.data);
        res.status(201).json({
            status: "success",
            message: "Product created successfully",
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createProduct = createProduct;
const uploadImages = async (req, res, next) => {
    try {
        const { productId } = req.params;
        const files = (0, upload_1.normalizeUploadedFiles)(req.files);
        if (files.length === 0) {
            throw new errors_1.ValidationError('No images uploaded. Use form-data with file field "images"');
        }
        const result = await (0, product_service_1.uploadProductImages)(productId, files);
        res.status(201).json({
            status: "success",
            message: "Images uploaded successfully",
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadImages = uploadImages;
