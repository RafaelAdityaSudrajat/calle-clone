// scripts/schema-smoke.ts
import { listProductsQuerySchema } from "../src/modules/product_v2/product_v2.schema";

function show(label: string, input: unknown) {
  try {
    const parsed = listProductsQuerySchema.parse(input);
    console.log(`\n✅ ${label}`);
    console.log("   input:", JSON.stringify(input));
    console.log("   output:", parsed);
  } catch (err) {
    console.log(`\n❌ ${label}`);
    console.log("   input:", JSON.stringify(input));
    if (err instanceof Error && "issues" in err) {
      const issues = (
        err as { issues: Array<{ path: string[]; message: string }> }
      ).issues;
      console.log(
        "   errors:",
        issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      );
    } else {
      console.log("   error:", err);
    }
  }
}

// ── Happy paths ────────────────────────────────────────────────
show("default (kosong)", {});
show("page & limit string", { page: "3", limit: "50" });
show("status DRAFT", { status: "DRAFT" });
show("search dengan spasi", { search: "  kaos  " });
show("search kosong", { search: "" });
show("include_deleted=true", { include_deleted: "true" });
show("include_deleted=false", { include_deleted: "false" });
show("category_id UUID valid", {
  category_id: "11111111-1111-4111-8111-111111111111",
});
show("unknown param (di-strip)", { unknown: "foo" });

// ── Error paths ────────────────────────────────────────────────
show("page=0", { page: "0" });
show("page=abc", { page: "abc" });
show("page=3.5", { page: "3.5" });
show("limit=101", { limit: "101" });
show("search terlalu panjang", { search: "x".repeat(101) });
show("status tidak valid", { status: "FOO" });
show("category_id bukan UUID", { category_id: "not-a-uuid" });
show("include_deleted=1", { include_deleted: "1" });
