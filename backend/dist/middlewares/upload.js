"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUploadedFiles = exports.productImageUploadFields = exports.ensureMultipartFormData = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const errors_1 = require("../lib/errors");
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        cb(new errors_1.ValidationError('Only JPEG, PNG, and WebP images are allowed'));
        return;
    }
    cb(null, true);
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE },
});
const ensureMultipartFormData = (req, res, next) => {
    if (req.is('multipart/form-data')) {
        next();
        return;
    }
    next(new errors_1.ValidationError('Request must use multipart/form-data with file field "images"'));
};
exports.ensureMultipartFormData = ensureMultipartFormData;
exports.productImageUploadFields = [
    { name: 'images', maxCount: 5 },
    { name: 'images[]', maxCount: 5 },
    { name: 'image', maxCount: 5 },
];
const normalizeUploadedFiles = (files) => {
    if (!files) {
        return [];
    }
    if (Array.isArray(files)) {
        return files;
    }
    return Object.values(files).flat();
};
exports.normalizeUploadedFiles = normalizeUploadedFiles;
