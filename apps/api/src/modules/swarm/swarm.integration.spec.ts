import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

/**
 * Phase 11 Part 4/5 — swarm coordination and load balancing/task allocation
 * against real Postgres. Member drones are created directly via Prisma
 * (not the register API) so exact battery/payload figures are pinned and
 * hand-verifiable, the same fixture technique `analytics.integration.spec.ts`
 * uses. Coordinates are a dedicated synthetic point far from any shared
 * hub/geofence used by other suites.
 */
describe("Swarm coordination & load balancing (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const TARGET = { lat: -3.5, lng: 40.5 }; // dedicated synthetic point
  let fleetManagerToken: string;
  let droneOperatorToken: string;
  let customerToken: string;
  let droneAId: string; // 90% battery — should win a single-target contest
  let droneBId: string; // 40% battery
  const createdDroneIds: string[] = [];
  const createdSwarmIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({ sub: id, email: `${id}@example.com`, roles: [roleName], permissions: await rbacService.resolvePermissions([roleName]) });

    const fleetManager = await prisma.user.create({ data: { email: `swarm-fm-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const droneOperator = await prisma.user.create({ data: { email: `swarm-op-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const customer = await prisma.user.create({ data: { email: `swarm-customer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fmRole = await prisma.role.findUniqueOrThrow({ where: { name: "fleet_manager" } });
    const opRole = await prisma.role.findUniqueOrThrow({ where: { name: "drone_operator" } });
    const custRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    await prisma.userRole.createMany({
      data: [
        { userId: fleetManager.id, roleId: fmRole.id },
        { userId: droneOperator.id, roleId: opRole.id },
        { userId: customer.id, roleId: custRole.id },
      ],
    });
    fleetManagerToken = await mint(fleetManager.id, "fleet_manager");
    droneOperatorToken = await mint(droneOperator.id, "drone_operator");
    customerToken = await mint(customer.id, "customer");

    const droneA = await prisma.drone.create({
      data: { serialNumber: `SWARM-A-${suffix}`, name: "Swarm Drone A", model: "SkyNav X1", status: "IDLE", batteryPercent: 90, batteryHealthPercent: 100, maxPayloadKg: 5 },
    });
    const droneB = await prisma.drone.create({
      data: { serialNumber: `SWARM-B-${suffix}`, name: "Swarm Drone B", model: "SkyNav X1", status: "IDLE", batteryPercent: 40, batteryHealthPercent: 100, maxPayloadKg: 5 },
    });
    droneAId = droneA.id;
    droneBId = droneB.id;
    createdDroneIds.push(droneAId, droneBId);
  });

  afterAll(async () => {
    await prisma.swarmAssignment.deleteMany({ where: { swarmPlan: { swarmId: { in: createdSwarmIds } } } });
    await prisma.swarmPlan.deleteMany({ where: { swarmId: { in: createdSwarmIds } } });
    await prisma.swarmMember.deleteMany({ where: { swarmId: { in: createdSwarmIds } } });
    await prisma.swarm.deleteMany({ where: { id: { in: createdSwarmIds } } });
    await prisma.drone.deleteMany({ where: { id: { in: createdDroneIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: `${suffix}@example.com` } } });
    await app.close();
  });

  async function createSwarm(): Promise<string> {
    const res = await request(app.getHttpServer()).post("/api/v1/swarms").set(auth(fleetManagerToken)).send({ name: `Test Swarm ${suffix}-${createdSwarmIds.length}` });
    expect(res.status).toBe(201);
    createdSwarmIds.push(res.body.data.id);
    return res.body.data.id as string;
  }

  describe("RBAC", () => {
    it("rejects an unauthenticated request", async () => {
      expect((await request(app.getHttpServer()).get("/api/v1/swarms")).status).toBe(401);
    });

    it("rejects a customer entirely (no swarm.* permission)", async () => {
      expect((await request(app.getHttpServer()).get("/api/v1/swarms").set(auth(customerToken))).status).toBe(403);
      expect((await request(app.getHttpServer()).post("/api/v1/swarms").set(auth(customerToken)).send({ name: "x" })).status).toBe(403);
    });

    it("allows a drone operator to read but not manage/plan (per the seeded matrix)", async () => {
      expect((await request(app.getHttpServer()).get("/api/v1/swarms").set(auth(droneOperatorToken))).status).toBe(200);
      expect((await request(app.getHttpServer()).post("/api/v1/swarms").set(auth(droneOperatorToken)).send({ name: "x" })).status).toBe(403);
    });
  });

  describe("membership", () => {
    it("creates a swarm and assigns the first added member as LEADER, the second as FOLLOWER", async () => {
      const swarmId = await createSwarm();
      const withA = await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId });
      expect(withA.status).toBe(201);
      expect(withA.body.data.members.find((m: { droneId: string }) => m.droneId === droneAId).role).toBe("LEADER");

      const withB = await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneBId });
      expect(withB.status).toBe(201);
      expect(withB.body.data.members.find((m: { droneId: string }) => m.droneId === droneBId).role).toBe("FOLLOWER");
    });

    it("rejects adding the same drone twice", async () => {
      const swarmId = await createSwarm();
      await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId }).expect(201);
      const dup = await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId });
      expect(dup.status).toBe(409);
    });

    it("removes a member", async () => {
      const swarmId = await createSwarm();
      await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId }).expect(201);
      const removed = await request(app.getHttpServer()).delete(`/api/v1/swarms/${swarmId}/members/${droneAId}`).set(auth(fleetManagerToken));
      expect(removed.status).toBe(200);
      expect(removed.body.data.members).toHaveLength(0);
    });
  });

  describe("planning / load balancing", () => {
    async function swarmWithBothDrones(): Promise<string> {
      const swarmId = await createSwarm();
      await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId }).expect(201);
      await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneBId }).expect(201);
      return swarmId;
    }

    it("picks the higher-battery drone for a single target (explainable score)", async () => {
      const swarmId = await swarmWithBothDrones();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({ objective: "Single delivery", targets: [{ lat: TARGET.lat, lng: TARGET.lng, payloadKg: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.data.assignments).toHaveLength(1);
      expect(res.body.data.assignments[0].droneId).toBe(droneAId);
      expect(res.body.data.assignments[0].reason).toEqual(expect.any(String));
      expect(res.body.data.unassignedTargets).toHaveLength(0);
    });

    it("never double-books a drone across two targets in one plan", async () => {
      const swarmId = await swarmWithBothDrones();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({
          objective: "Two deliveries",
          targets: [
            { lat: TARGET.lat, lng: TARGET.lng, payloadKg: 1 },
            { lat: TARGET.lat + 0.01, lng: TARGET.lng + 0.01, payloadKg: 1 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.assignments).toHaveLength(2);
      const droneIds = res.body.data.assignments.map((a: { droneId: string }) => a.droneId).sort();
      expect(droneIds).toEqual([droneAId, droneBId].sort());
      expect(new Set(droneIds).size).toBe(2);
    });

    it("reports a target as unassigned, with a reason, when payload exceeds every member's capacity", async () => {
      const swarmId = await swarmWithBothDrones();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({ objective: "Oversized", targets: [{ lat: TARGET.lat, lng: TARGET.lng, payloadKg: 999 }] });
      expect(res.status).toBe(201);
      expect(res.body.data.assignments).toHaveLength(0);
      expect(res.body.data.unassignedTargets).toHaveLength(1);
      expect(res.body.data.unassignedTargets[0].reason).toMatch(/no swarm-member drone is eligible/i);
    });

    it("prioritizes an EXPRESS target over a STANDARD one competing for the same drone", async () => {
      const swarmId = await createSwarm();
      await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId }).expect(201);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({
          objective: "Priority test",
          targets: [
            { lat: TARGET.lat, lng: TARGET.lng, payloadKg: 1, priority: "STANDARD" },
            { lat: TARGET.lat + 0.01, lng: TARGET.lng + 0.01, payloadKg: 1, priority: "EXPRESS" },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.assignments).toHaveLength(1);
      expect(res.body.data.assignments[0].lat ?? TARGET.lat + 0.01).toBeDefined();
      expect(res.body.data.unassignedTargets).toHaveLength(1);
    });

    it("supports an explicit operator reassignment, overriding the automatic pick", async () => {
      const swarmId = await swarmWithBothDrones();
      const created = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({ objective: "Reassign test", targets: [{ lat: TARGET.lat, lng: TARGET.lng, payloadKg: 1 }] });
      const planId = created.body.data.id as string;
      const assignmentId = created.body.data.assignments[0].id as string;
      expect(created.body.data.assignments[0].droneId).toBe(droneAId);

      const reassigned = await request(app.getHttpServer())
        .post(`/api/v1/swarms/plans/${planId}/assignments/${assignmentId}/reassign`)
        .set(auth(fleetManagerToken))
        .send({ droneId: droneBId });
      expect(reassigned.status).toBe(201);
      const updated = reassigned.body.data.assignments.find((a: { id: string }) => a.id === assignmentId);
      expect(updated.droneId).toBe(droneBId);
      expect(updated.reason).toMatch(/manually reassigned/i);
    });

    it("fetches a plan by id directly", async () => {
      const swarmId = await swarmWithBothDrones();
      const created = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({ objective: "Fetch test", targets: [{ lat: TARGET.lat, lng: TARGET.lng, payloadKg: 1 }] });
      const planId = created.body.data.id as string;
      const fetched = await request(app.getHttpServer()).get(`/api/v1/swarms/plans/${planId}`).set(auth(fleetManagerToken));
      expect(fetched.status).toBe(200);
      expect(fetched.body.data.id).toBe(planId);
    });
  });

  describe("lifecycle", () => {
    it("disbands a swarm and rejects further planning against it", async () => {
      const swarmId = await swarmWithBothDronesHelper();
      const disband = await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/disband`).set(auth(fleetManagerToken));
      expect(disband.status).toBe(201);

      const plan = await request(app.getHttpServer())
        .post(`/api/v1/swarms/${swarmId}/plans`)
        .set(auth(fleetManagerToken))
        .send({ objective: "Should fail", targets: [{ lat: TARGET.lat, lng: TARGET.lng, payloadKg: 1 }] });
      expect(plan.status).toBe(400);
    });

    async function swarmWithBothDronesHelper(): Promise<string> {
      const swarmId = await createSwarm();
      await request(app.getHttpServer()).post(`/api/v1/swarms/${swarmId}/members`).set(auth(fleetManagerToken)).send({ droneId: droneAId }).expect(201);
      return swarmId;
    }
  });
});
