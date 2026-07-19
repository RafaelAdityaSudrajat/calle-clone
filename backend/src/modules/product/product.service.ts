import cloudinary from "../../lib/cloudinary";

import { prisma } from "../../lib/prisma";
import { CreateProductInput } from "./product.validation";
import { GetProductsQuery } from "./product.validation";
import { UpdateProductInput } from "./product.validation";
import { NotFoundError } from "../../lib/errors";

const generateSlug = async (name: string): Promise<string> => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const existing = await prisma.product.findUnique({ where: { slug: base } });
  if (!existing) return base;

  let counter = 1;
  while (true) {
    const slug = `${base}-${counter}`;
    const found = await prisma.product.findUnique({ where: { slug } });
    if (!found) return slug;
    counter++;
  }
};

export const createProductService = async (input: CreateProductInput) => {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  const slug = await generateSlug(input.name);

  return prisma.$transaction(async (tx) => {
    return tx.product.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        price: input.price,
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

export const updateProductService = async (
  id: string,
  input: UpdateProductInput,
) => {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw new NotFoundError("Category not found");
  }

  let slug = product.slug;
  if (input.name && input.name !== product.name) {
    slug = await generateSlug(input.name);
  }

  return prisma.product.update({
    where: { id },
    data: { ...input, slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { order: "asc" } },
      variants: true,
    },
  });
};

export const getProductsService = async (query: GetProductsQuery) => {
  const { page, limit, search, categoryId, isActive } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      name: { contains: search, mode: "insensitive" as const },
    }),
    ...(categoryId && { categoryId }),
    ...(isActive !== undefined && { isActive }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        variants: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data: products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getProductByIdService = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { order: "asc" } },
      variants: true,
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

export const deleteProductService = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  await prisma.product.delete({ where: { id } });
};

export const uploadProductImages = async (
  productId: string,
  files: Express.Multer.File[],
) => {
  const uploadPromises = files.map(async (file, index) => {
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: "products",
      transformation: [{ width: 800, height: 800, crop: "limit" }],
    });

    return prisma.productImage.create({
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
