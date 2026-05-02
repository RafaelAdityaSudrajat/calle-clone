import { prisma } from '../../lib/prisma';
import { CreateCategoryInput } from './category.validation';
import { ConflictError } from '../../lib/errors';

const generateSlug = async (name: string): Promise<string> => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

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
    where: { name: { equals: input.name, mode: 'insensitive' } },
  });

  if (existing) {
    throw new ConflictError('Category already exists');
  }

  const slug = await generateSlug(input.name);

  return prisma.category.create({
    data: { name: input.name, slug },
  });
};