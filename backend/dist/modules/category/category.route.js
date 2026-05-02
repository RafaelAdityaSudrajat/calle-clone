"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authenticate_1 = require("../../middlewares/authenticate");
const category_controller_1 = require("./category.controller");
const router = (0, express_1.Router)();
router.post('/', authenticate_1.authenticate, category_controller_1.createCategory);
exports.default = router;
