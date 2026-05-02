"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const auth_validation_1 = require("./auth.validation");
const auth_service_1 = require("./auth.service");
const auth_validation_2 = require("./auth.validation");
const auth_service_2 = require("./auth.service");
const errors_1 = require("../../lib/errors");
const register = async (req, res, next) => {
    try {
        const parsed = auth_validation_1.registerSchema.safeParse(req.body);
        if (!parsed.success) {
            const message = parsed.error.errors[0].message;
            throw new errors_1.ValidationError(message);
        }
        const result = await (0, auth_service_1.registerService)(parsed.data);
        res.status(201).json({
            status: "success",
            message: "Register successful",
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const parsed = auth_validation_2.loginSchema.safeParse(req.body);
        if (!parsed.success) {
            const message = parsed.error.errors[0].message;
            throw new errors_1.ValidationError(message);
        }
        const result = await (0, auth_service_2.loginService)(parsed.data);
        res.status(200).json({
            status: "success",
            message: "Login successful",
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
// user
const getMe = async (req, res, next) => {
    try {
        const result = await (0, auth_service_1.getMeService)(req.userId);
        res.status(200).json({
            status: "success",
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
