"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeService = exports.loginService = exports.registerService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const env_1 = require("../../config/env");
// auth
const registerService = async (input) => {
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { email: input.email },
    });
    if (existingUser) {
        throw new errors_1.ConflictError("Email already registered");
    }
    const hashedPassword = await bcrypt_1.default.hash(input.password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            fullName: input.fullName,
            email: input.email,
            password: hashedPassword,
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true,
        },
    });
    const token = jsonwebtoken_1.default.sign({ id: user.id }, env_1.env.JWT_SECRET, {
        expiresIn: "7d",
    });
    return { user, token };
};
exports.registerService = registerService;
const loginService = async (input) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: input.email },
    });
    if (!user) {
        throw new errors_1.UnauthorizedError("Invalid email or password");
    }
    const isPasswordValid = await bcrypt_1.default.compare(input.password, user.password);
    if (!isPasswordValid) {
        throw new errors_1.UnauthorizedError("Invalid email or password");
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id }, env_1.env.JWT_SECRET, {
        expiresIn: "7d",
    });
    return {
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            createdAt: user.createdAt,
        },
        token,
    };
};
exports.loginService = loginService;
// user
const getMeService = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true,
        },
    });
    if (!user) {
        throw new errors_1.NotFoundError("User not found");
    }
    return user;
};
exports.getMeService = getMeService;
