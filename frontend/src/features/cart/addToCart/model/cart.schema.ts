import z from "zod";


export const updateCartSchema = z.object({
    productVariantId: z.string(), 
    quantity: z.number()
})

export type updateCartInputFormValues = z.infer<typeof updateCartSchema>;