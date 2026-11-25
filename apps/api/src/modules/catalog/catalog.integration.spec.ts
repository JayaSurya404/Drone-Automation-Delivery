import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

/**
 * Full CRUD for categories/products/variants/images against real Postgres,
 * with RBAC enforcement (Catalog Manager can, Customer cannot). Run via
 * `pnpm test:integration`.
 */
describe("Catalog CRUD + RBAC (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let catalogManagerToken: string;
  let customerToken: string;

  const suffix = Date.now();
  const categorySlug = `test-category-${suffix}`;
  const productSlug = `test-product-${suffix}`;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let imageId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const rbacService = app.get(RbacService);
    const mint = async (roleName: string) =>
      jwtService.signAsync({
        sub: `test-${roleName}-${suffix}`,
        email: `${roleName}-${suffix}@example.com`,
        roles: [roleName],
        permissions: await rbacService.resolvePermissions([roleName]),
      });
    catalogManagerToken = await mint("catalog_manager");
    customerToken = await mint("customer");
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: productSlug } });
    await prisma.category.deleteMany({ where: { slug: categorySlug } });
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  describe("categories", () => {
    it("rejects category creation for an unauthenticated caller and a customer", async () => {
      const anon = await request(app.getHttpServer())
        .post("/api/v1/categories")
        .send({ name: "Nope", slug: `nope-${suffix}` });
      expect(anon.status).toBe(401);

      const asCustomer = await request(app.getHttpServer())
        .post("/api/v1/categories")
        .set(auth(customerToken))
        .send({ name: "Nope", slug: `nope-${suffix}` });
      expect(asCustomer.status).toBe(403);
    });

    it("lets a Catalog Manager create, read, update, and soft-delete a category", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/categories")
        .set(auth(catalogManagerToken))
        .send({ name: "Test Category", slug: categorySlug, description: "temp" });
      expect(create.status).toBe(201);
      expect(create.body.data.slug).toBe(categorySlug);
      categoryId = create.body.data.id;

      const publicRead = await request(app.getHttpServer()).get(`/api/v1/categories/${categorySlug}`);
      expect(publicRead.status).toBe(200);

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set(auth(catalogManagerToken))
        .send({ description: "updated" });
      expect(update.status).toBe(200);
      expect(update.body.data.description).toBe("updated");

      const asCustomerDelete = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${categoryId}`)
        .set(auth(customerToken));
      expect(asCustomerDelete.status).toBe(403);
    });
  });

  describe("products", () => {
    it("rejects product creation for a customer", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(auth(customerToken))
        .send({ name: "x", slug: `x-${suffix}`, basePrice: 1, variants: [{ sku: `x-${suffix}`, name: "Default" }] });
      expect(res.status).toBe(403);
    });

    it("lets a Catalog Manager create a product with a variant, then read it publicly", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set(auth(catalogManagerToken))
        .send({
          name: "Test Product",
          slug: productSlug,
          description: "A product created by an integration test",
          basePrice: 9.99,
          categoryId,
          variants: [{ sku: `TEST-SKU-${suffix}`, name: "Default" }],
        });
      expect(create.status).toBe(201);
      expect(create.body.data.variants).toHaveLength(1);
      productId = create.body.data.id;
      variantId = create.body.data.variants[0].id;

      const publicRead = await request(app.getHttpServer()).get(`/api/v1/products/${productSlug}`);
      expect(publicRead.status).toBe(200);
      expect(publicRead.body.data.price).toBe(9.99);
    });

    it("appears in the public product list and search", async () => {
      const list = await request(app.getHttpServer()).get("/api/v1/products").query({ category: categorySlug });
      expect(list.status).toBe(200);
      expect(list.body.data.products.some((p: { slug: string }) => p.slug === productSlug)).toBe(true);

      const searched = await request(app.getHttpServer()).get("/api/v1/products").query({ q: "integration test" });
      expect(searched.status).toBe(200);
      expect(searched.body.data.products.some((p: { slug: string }) => p.slug === productSlug)).toBe(true);
    });

    it("lets a Catalog Manager add, update, and remove a variant", async () => {
      const add = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/variants`)
        .set(auth(catalogManagerToken))
        .send({ sku: `TEST-SKU-2-${suffix}`, name: "Large" });
      expect(add.status).toBe(201);
      const secondVariantId = add.body.data.id;

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}/variants/${secondVariantId}`)
        .set(auth(catalogManagerToken))
        .send({ priceOverride: 14.99 });
      expect(update.status).toBe(200);
      expect(Number(update.body.data.priceOverride)).toBe(14.99);

      const remove = await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}/variants/${secondVariantId}`)
        .set(auth(catalogManagerToken));
      expect(remove.status).toBe(200);
    });

    it("refuses to delete the last remaining variant", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}/variants/${variantId}`)
        .set(auth(catalogManagerToken));
      expect(res.status).toBe(400);
    });

    it("lets a Catalog Manager upload and delete a product image, rejects it for a customer", async () => {
      const tinyPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      );

      const rejected = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/images`)
        .set(auth(customerToken))
        .attach("file", tinyPng, "pixel.png");
      expect(rejected.status).toBe(403);

      const upload = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/images`)
        .set(auth(catalogManagerToken))
        .attach("file", tinyPng, "pixel.png");
      expect(upload.status).toBe(201);
      expect(upload.body.data.url).toContain("/api/v1/media/");
      imageId = upload.body.data.id;

      const withImage = await request(app.getHttpServer()).get(`/api/v1/products/${productSlug}`);
      expect(withImage.body.data.images).toHaveLength(1);

      const remove = await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}/images/${imageId}`)
        .set(auth(catalogManagerToken));
      expect(remove.status).toBe(200);
    });

    it("rejects a non-image upload regardless of a spoofed Content-Type (Phase 12 — magic-number detection)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/images`)
        .set(auth(catalogManagerToken))
        .attach("file", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), {
          filename: "image.svg",
          contentType: "image/svg+xml",
        });
      expect(res.status).toBe(400);
    });

    it("soft-deletes a product so it disappears from public reads", async () => {
      const remove = await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set(auth(catalogManagerToken));
      expect(remove.status).toBe(200);

      const afterDelete = await request(app.getHttpServer()).get(`/api/v1/products/${productSlug}`);
      expect(afterDelete.status).toBe(404);
    });
  });
});
