import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAuditService } from "../audit.service.js";

describe("Audit / Service & Event Logging", () => {
  it("records and queries structured audit events", async () => {
    const memoryDb: any = {
      logs: [] as any[],
      insertInto() {
        return {
          values(val: any) {
            return {
              async execute() {
                memoryDb.logs.push({ ...val, created_at: new Date() });
              }
            };
          }
        };
      },
      selectFrom() {
        return {
          selectAll() {
            return {
              where(_col: string, _op: string, val: string) {
                return {
                  orderBy() {
                    return {
                      limit(lim: number) {
                        return {
                          offset(off: number) {
                            return {
                              async execute() {
                                return memoryDb.logs
                                  .filter((l: any) => l.organization_id === val)
                                  .slice(off, off + lim);
                              }
                            };
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
    };

    const service = createAuditService(memoryDb);

    await service.log({
      organizationId: "00000000-0000-0000-0000-000000000001",
      actorUserId: "11111111-1111-1111-1111-111111111111",
      action: "MISSION_AUTHORIZED",
      resourceType: "mission",
      resourceId: "99999999-9999-9999-9999-999999999999",
      metadata: { waypoints: 4, droneId: "drone-01" }
    });

    const results = await service.list("00000000-0000-0000-0000-000000000001");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.action, "MISSION_AUTHORIZED");
    assert.equal(results[0]?.resource_type, "mission");
    assert.equal(results[0]?.resource_id, "99999999-9999-9999-9999-999999999999");
  });
});
