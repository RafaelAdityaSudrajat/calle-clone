"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const multer_1 = __importDefault(require("multer"));
const errors_1 = require("../lib/errors");
const errorHandler = (err, req, res, next) => {
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({
            status: 'error',
            code: err.statusCode,
            message: err.message,
        });
        return;
    }
    if (err instanceof multer_1.default.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'Each image must be 2MB or smaller'
            : err.code === 'LIMIT_UNEXPECTED_FILE'
                ? 'Use form-data file field "images", "images[]", or "image"'
                : err.message;
        res.status(400).json({
            status: 'error',
            code: 400,
            message,
        });
        return;
    }
    // unexpected error — jangan expose detail ke client
    console.error(err);
    res.status(500).json({
        status: 'error',
        code: 500,
        message: 'Internal server error',
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        status: 'error',
        code: 404,
        message: `Route ${req.method} ${req.path} not found`,
    });
};
exports.notFoundHandler = notFoundHandler;
