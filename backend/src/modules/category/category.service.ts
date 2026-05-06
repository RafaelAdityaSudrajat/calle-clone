import { prisma } from "../../lib/prisma";
import { CreateCategoryInput } from "./category.validation";
import { ConflictError, NotFoundError } from "../../lib/errors";

const generateSlug = async (name: string): Promise<string> => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const existing = await prisma.category.findUnique({ where: { slug: base } });
  if (!existing) return base;

  let counter = 1;
  while (true) {
    const slug = `${base}-${counter}`;
    const found = await prisma.category.findUnique({ where: { slug } });
    if (!found) return slug;
    counter++;
  }
};

export const createCategoryService = async (input: CreateCategoryInput) => {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });

  if (existing) {
    throw new ConflictError("Category already exists");
  }

  const slug = await generateSlug(input.name);

  return prisma.category.create({
    data: { name: input.name, slug },
  });
};

export const getCategoriesService = async () => {
  return prisma.category.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const getCategoryByIdService = async (id: string) => {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  return category;
};

export const updateCategoryService = async (
  id: string,
  input: CreateCategoryInput,
) => {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  const existing = await prisma.category.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, NOT: { id } },
  });

  if (existing) {
    throw new ConflictError("Category already exists");
  }

  const slug = await generateSlug(input.name);

  return prisma.category.update({
    where: { id },
    data: { name: input.name, slug },
  });
};

export const deleteCategoryService = async (id: string) => {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  await prisma.category.delete({ where: { id } });
};
