import z from "zod";


export const updateCartSchema = z.object({
    productVariantId: z.string(), 
    quantity: z.number()
})

export type updateCartInputValues = z.infer<typeof updateCartSchema>;